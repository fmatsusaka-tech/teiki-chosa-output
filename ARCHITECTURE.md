# ARCHITECTURE.md

## 最小構成

- フレームワーク: Next.js 15 (App Router) + React 19 + TypeScript
- 実行形態: サーバーレンダリング（`output: "standalone"`）。静的エクスポートではない。
- テスト: Vitest
- Lint: ESLint 9 (`eslint-config-next`)
- ホスティング（設計のみ、未デプロイ）: Google Cloud Run + Identity-Aware Proxy

## ディレクトリ構成

```text
src/
  app/           Next.js App Router（画面・ルーティング）
  contracts/     Input/Output間のデータ契約定義
  features/      画面横断の純粋ロジック（分析、予測、気象、マスタ）
  repositories/  クライアント向けデータアクセス（GViz経路、旧実装含む）
  server/        サーバー専用の認証付きデータアクセス（Google Sheets API）
  hosting/       Cloud Runホスティング関連ロジック

scripts/         予測マスタ生成・書込み用CLI（.prediction-cli経由で実行）
docs/            連携契約・設計ドキュメント
```

## 責務

- `src/server/*`: サービスアカウント認証を用いたGoogle Sheets APIへの読取（一部Writer）。秘密鍵はここでのみ扱い、ブラウザへ渡さない。
- `src/repositories/*`: 認証を伴わないGViz経路の実装。認証付き経路（`src/server`）への移行が [Issue #22](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/22) で進行中（定期調査分析・園地分析は認証付き経路へ移行済み）。
- `src/features/*`: 画面に依存しない分析・予測・正規化ロジックとそのテスト。
- `src/app/*`: 上記を組み合わせた画面。ページコンポーネントはできる限り薄く保つ。

## データフロー

```text
Input正本 Spreadsheet（調査データ）
  └─(認証付き読取)→ src/server/analysis-data
       └→ src/repositories/analysis-data-repository（見出し名解決・正規化・有効状態フィルタ）
            └→ src/features/periodic-analysis, orchard-analysis
                 └→ src/app/analysis, src/app/orchards（画面）

予測原典 Spreadsheet（横径予測/糖度予測/酸度予測）
  └─(認証付き読取)→ src/server/prediction-data（Prediction Master Reader）
       └→ scripts/generate-prediction-masters, write-prediction-masters（CLI、正規化・書込み）
            └→ Output専用 正規化予測マスタ Spreadsheet
                 └─(認証付き読取)→ src/server/prediction-data
                      └→ src/features/prediction-engine, prediction-integration
                           └→ src/app/predictions（統合予測ダッシュボード）

気象データCSV（公開Google Sheetsエクスポート、認証不要）
  └→ src/server/weather → src/features/weather → 分析・予測画面へ合成
```

## 外部システム・セキュリティ境界

外部連携先の一覧は [REQUIREMENTS.md](REQUIREMENTS.md) の「外部連携」を参照してください。

- Reader系サービスアカウントは `spreadsheets.readonly` スコープのみを使用する。
- Prediction Master Writerは独立した資格情報を持ち、Writer Issueで定義・検証されたWriterだけが書込みを行う。
- 認証失敗時に匿名GViz経路へ自動フォールバックしない（[docs/cloud-run-hosting.md](docs/cloud-run-hosting.md)）。
- `/api/health` はステータスのみを返し、Input・予測マスタ・資格情報・環境値にアクセスしない。

## ホスティング（設計、実運用は未デプロイ）

Cloud Run + IAPによる保護を前提とした設計・Dockerfile（マルチステージビルド、`npm ci`→build→standalone起動）は存在するが、Cloud Billing・Artifact Registry・Cloud Run・Secret Manager・IAP・OAuth・IAMの実際の作成・設定は別の運用Issueで扱われており、本リポジトリの変更だけでは本番稼働しない。詳細は [docs/cloud-run-hosting.md](docs/cloud-run-hosting.md) を参照。

## 障害時設計

- Input側の認証・接続に失敗した場合、分析・予測画面はエラー表示のみを行い、匿名経路へのフォールバックや推測データの表示は行わない（例: `src/app/predictions/page.tsx` のcatch節）。
- Prediction Master Writerは失敗時に既存マスタを破損させない設計とする（[docs/prediction-master-writer.md](docs/prediction-master-writer.md)）。

## 既知の技術的負債

詳細は [ROADMAP.md](ROADMAP.md) の「技術的負債」を参照してください。
