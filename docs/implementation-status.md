# Output 実装状況

最終確認日: 2026-07-27

## 正式な作業リポジトリ

- リポジトリ: `fmatsusaka-tech/teiki-chosa-output`
- 既定ブランチ: `main`
- 開発基盤: Next.js 15 / TypeScript / ESLint / Vitest
- 実行コマンド: `npm run typecheck`、`npm run lint`、`npm test`、`npm run build`

## 承認済み成果物

| 成果物 | 状態 | 配置 |
|---|---|---|
| AGENTS.md | 配置済み | `AGENTS.md` |
| Output 固有の読取境界 | 配置済み | `AGENTS.md`、本書 |
| Input 連携契約（調査データ23列） | 統合済み | `docs/analysis-data-interface-contract.md` |
| Input 連携型・見出しマッピング | 統合済み | `src/contracts/analysis-data.ts` |
| Prediction Engine 基盤 | 未確認・未配置 | 該当する追跡済みソースは `main` に存在しない |

## 現行 main の確認結果

現行 `main` には、OCR、入力確認、Google Sheets への登録・保存など、Input の責務に属する実装が含まれる。
一方で Output の分析、比較、予測、PredictionCoefficients、PredictionEngine は存在しない。

この Issue では既存の Input 実装を削除・移動・変更しない。Output の今後の Issue は、
`src/contracts/analysis-data.ts` と `docs/analysis-data-interface-contract.md` を唯一の連携入口として実装する。

## 未実装一覧

- 調査データの読取クライアント
- 横径・糖度・酸度の分析
- 園地比較
- PredictionCoefficients
- PredictionEngine
- 係数生成基盤
- 分析・予測 UI

## 次の機能Issueへ進むための前提

次の機能Issueでは、`調査データ` タブを読取専用で取得するアダプターを実装する。
他タブや Input 側の更新処理を利用・変更してはならない。

## 開発基盤の確認結果

2026-07-27 時点の確認結果は次のとおり。

| コマンド | 結果 | 備考 |
|---|---|---|
| `npm run typecheck` | 成功 | 型エラーなし |
| `npm run lint` | 成功（警告1件） | 既存の `eslint.config.mjs` に関する警告 |
| `npm test` | 失敗 | 既存の OCR Provider テスト1件が、PaddleOCR sidecar を利用可能と判定したため失敗。Output 統合とは無関係のため本Issueでは修正しない。 |
| `npm run build` | 成功 | Next.js 本番ビルド完了 |
