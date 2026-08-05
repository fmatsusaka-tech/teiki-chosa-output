# 定期調査 Output

Input（[teiki-chosa-input](https://github.com/fmatsusaka-tech/teiki-chosa-input)）が管理する `調査データ` タブを読取専用で利用し、定期調査データの分析・比較・予測を行うシステムです。

目的や対象利用者の詳細は [VISION.md](VISION.md)、要件は [REQUIREMENTS.md](REQUIREMENTS.md) を参照してください。

## リポジトリ

現在の正式リポジトリは以下の `origin` のみです。

- https://github.com/fmatsusaka-tech/teiki-chosa-output

旧リポジトリ `teiki-chosa-system`（`legacy` remote）は使用されていないため、ローカルの remote 設定から削除済みです。

## 実装状況

- 定期調査分析・園地分析・各種予測（横径/糖度/酸度の統合ダッシュボード）は実データで実装済みです。
- データ管理画面は骨格のみで、検索・確認機能は未実装です。

詳細な機能単位の状況は [docs/implementation-status.md](docs/implementation-status.md)、実装フェーズと技術的負債は [ROADMAP.md](ROADMAP.md) を参照してください。

## 構成・技術

- Next.js 15 (App Router) + React 19 + TypeScript、テストはVitest
- 詳細なディレクトリ構成・データフローは [ARCHITECTURE.md](ARCHITECTURE.md) を参照してください。

## 境界

- Input は唯一の正本であり、Output は更新しません。
- Output が `調査データ` タブ以外で参照できるのは、予測原典 Spreadsheet（横径予測/糖度予測/酸度予測）とOutput専用の正規化予測マスタだけです。
- OCR、入力、登録、保存は Input の責務であり、このリポジトリには実装しません。

詳細な境界とルールは [AGENTS.md](AGENTS.md) を参照してください。連携仕様は [Output 調査データ連携契約](docs/analysis-data-interface-contract.md) を参照してください。

## 環境変数

値は `.env.prediction.local`（Git管理外）等に設定します。値そのものはコミットしません。

| 変数名 | 用途 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Reader共用サービスアカウント（調査データ・予測原典・園地マスタの読取専用） |
| `ANALYSIS_DATA_SPREADSHEET_ID` / `ANALYSIS_DATA_SHEET_ID` | Input正本Spreadsheet・`調査データ`シートのID |
| `ORCHARD_MASTER_SPREADSHEET_ID` | 園地名マスタSpreadsheetのID |
| `PREDICTION_SPREADSHEET_ID` | 予測原典Spreadsheet（横径予測/糖度予測/酸度予測）のID |
| `PREDICTION_MASTER_SPREADSHEET_ID` / `PREDICTION_MASTER_DATA_VERSION` | Output専用 正規化予測マスタSpreadsheetのID・データ版 |
| `PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL` / `PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY` | Prediction Master Writer専用サービスアカウント（書込み権限、通常経路からは使用しない） |

## セットアップ・開発

```text
npm install
npm run dev
```

## 検証

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Prediction Masters CLI（`.env.prediction.local`が必要）:

```text
npm run prediction:masters:dry-run
npm run prediction:mvp:verify
```

## デプロイ状況

Google Cloud Run + Identity-Aware Proxyを前提とした設計・Dockerfileは実装済みですが、実際のCloud資源作成・本番デプロイは別の運用Issueで扱われており未実施です。詳細は [docs/cloud-run-hosting.md](docs/cloud-run-hosting.md) を参照してください。

## 既知の制約・技術的負債

- npm audit High 4件（`next@16`系への破壊的アップグレードが必要、[Issue #97](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/97) で計画中）
- package-lock.jsonの整合性を検証する早期CIステップが未整備

詳細は [ROADMAP.md](ROADMAP.md) の「技術的負債」を参照してください。

## エージェント向け文書

人間・Claude Code・Codex等が共有する運用ルールは [AGENTS.md](AGENTS.md)（正本）、Claude Code向け入口は [CLAUDE.md](CLAUDE.md)、作業引き継ぎは [docs/agents/HANDOFF.md](docs/agents/HANDOFF.md) を参照してください。
