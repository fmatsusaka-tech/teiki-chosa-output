# ARCHITECTURE.md

## 最小構成

- フレームワーク: Next.js 15 (App Router) + React 19 + TypeScript
- 実行形態: サーバーレンダリング（`output: "standalone"`）。静的エクスポートではない。
- テスト: Vitest
- Lint: ESLint 9 (`eslint-config-next`)
- ホスティング: Google Cloud Run + Identity-Aware Proxy を前提とした設計・Dockerfileが存在する（実運用デプロイの有無は文書間で矛盾しており未確認、詳細は「ホスティング」節を参照）

## ディレクトリ構成

```text
src/
  app/           Next.js App Router（画面・ルーティング）
  contracts/     Input/Output間のデータ契約定義
  features/      画面横断の純粋ロジック（分析、予測、気象、マスタ）
  repositories/  正規化・検証ロジック（見出し名解決、カレンダー日付処理など。Google Sheetsクライアント自体は含まない）
  server/        サーバー専用の認証付きデータアクセス（Google Sheets API）、共通JWT認証（`server/google-sheets/`）
  hosting/       Cloud Runホスティング関連ロジック

scripts/         予測マスタ生成・書込み用CLI（.prediction-cli経由で実行）
docs/            連携契約・設計ドキュメント
```

## 責務

- `src/server/*`: サービスアカウント認証を用いたGoogle Sheets APIへの読取（一部Writer）。JWTアサーション生成・トークン取得は`src/server/google-sheets/google-sheets-auth.ts`に共通化されている。秘密鍵はここでのみ扱い、ブラウザへ渡さない。
- `src/repositories/*`: Google Sheetsクライアントを含まない正規化・検証ロジック（見出し名解決、カレンダー日付処理）。認証を伴わない旧GViz読取実装は削除済み（後述）。
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

Input正本 Spreadsheet（調査データ、全件）
  └→ src/server/analysis-data/data-management-page-data
       └→ src/features/data-diagnostics（分析対象から除外された行の理由を判定）
            └→ src/app/data-management（開発者用データチェック画面）
```

旧・認証を伴わないGViz読取実装（`src/repositories/google-sheets-analysis-data-source.ts`、本番Input正本のSpreadsheet IDがハードコードされていた）は、実行経路から到達不能であったため削除済み（詳細は[docs/audit/REPOSITORY_AUDIT.md](docs/audit/REPOSITORY_AUDIT.md) CR-2）。

## 外部システム・セキュリティ境界

外部連携先の一覧は [REQUIREMENTS.md](REQUIREMENTS.md) の「外部連携」を参照してください。

- Reader系サービスアカウントは `spreadsheets.readonly` スコープのみを使用する。
- Prediction Master Writerは独立した資格情報を持ち、Writer Issueで定義・検証されたWriterだけが書込みを行う。
- 認証失敗時に匿名GViz経路へ自動フォールバックしない（[docs/cloud-run-hosting.md](docs/cloud-run-hosting.md)）。
- `/api/health` はステータスのみを返し、Input・予測マスタ・資格情報・環境値にアクセスしない。

## ホスティング（実運用デプロイ状況は未確認・文書間で矛盾）

Cloud Run + IAPによる保護を前提とした設計・Dockerfile（マルチステージビルド、`npm ci`→build→standalone起動）が存在する。

実際にデプロイ済みかどうかは文書間で矛盾している。

- [docs/cloud-run-hosting.md](docs/cloud-run-hosting.md): 「Cloud Billing・Artifact Registry・Cloud Run・Secret Manager・IAP・OAuth・IAMの実際の作成・設定は別の運用Issueで扱う」＝未デプロイの前提で書かれている。
- [docs/audit/REPOSITORY_AUDIT.md](docs/audit/REPOSITORY_AUDIT.md): 「本番はCloud Run + IAPで保護され継続的デプロイ（main push→即デプロイ）が組まれている」＝稼働中の前提で書かれている。

本リポジトリの`.github/workflows/`にはデプロイ用ワークフローが存在しないため、デプロイされているとすればCloud Build等リポジトリ外の仕組みによるものと推測されるが、本Issueの範囲（読み取り調査）では確認できなかった。実際の運用状態はOwnerに確認し、判明次第どちらかの文書を更新することを推奨する。

## 障害時設計

- Input側の認証・接続に失敗した場合、分析・予測画面はエラー表示のみを行い、匿名経路へのフォールバックや推測データの表示は行わない（例: `src/app/predictions/page.tsx` のcatch節）。
- Prediction Master Writerは失敗時に既存マスタを破損させない設計とする（[docs/prediction-master-writer.md](docs/prediction-master-writer.md)）。

## 既知の技術的負債

2026-08-04付けで [docs/audit/REPOSITORY_AUDIT.md](docs/audit/REPOSITORY_AUDIT.md) による全体監査が実施済みで、Critical/High項目の大半は本Issue時点で対応済み。残る項目は [ROADMAP.md](ROADMAP.md) の「技術的負債」を参照してください。
