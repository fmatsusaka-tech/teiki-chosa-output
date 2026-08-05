# REQUIREMENTS.md

実装済み機能を基点に、現状の要件を記録します（既存プロジェクト導入時点の復元）。実装済み・未実装・対象外の区分は [ROADMAP.md](ROADMAP.md) と [docs/implementation-status.md](docs/implementation-status.md) にも詳細があります。

## 主要ユースケース

- UC-1: 利用者が定期調査分析画面で、園地・品種・区・年度を絞り込み、実測値・前回差・年度比較を確認する。
- UC-2: 利用者が園地分析画面で、単一園地の時系列カルテ、または2園地の比較表を確認する。
- UC-3: 利用者が各種予測ダッシュボードで、現在の測定値と気象データから横径・糖度・酸度の収穫時予測（仮定値シミュレーター）を確認する。
- UC-4: システムがInput正本の `調査データ` を読取専用で取得し、見出し名で正規化・検証してから上記画面へ供給する。

## 機能要件

### 実装済み

- 定期調査分析（実データ接続、年度比較、前回差、有効状態が`有効`の行のみ対象、横スクロール同期）
- 園地分析（単一園地の時系列カルテ、2園地比較）
- 各種予測ダッシュボード（Prediction Engine、Prediction Master Reader/Writer、気象データ統合、仮定値シミュレーター）
- Input正本の認証付き読取（Google Sheets API、`https://www.googleapis.com/auth/spreadsheets.readonly` スコープ固定）
- 予測原典 Spreadsheet（横径予測/糖度予測/酸度予測）の認証付き読取
- Output専用 正規化予測マスタの読取（Reader）と、独立Issueで検証済みのWriter基盤
- 気象データ（気象庁由来CSV、公開Google Sheetsエクスポート）の読取・30日集計
- ヘルスチェックAPI (`/api/health`)
- Cloud Run + IAP を前提としたホスティング設計・Dockerfile（実運用デプロイは未実施、[ARCHITECTURE.md](ARCHITECTURE.md) 参照）

### 未実装

- データ管理画面（`/data-management`）: 静的なプレースホルダのみで、検索・確認機能は未実装。

### 対象外（Inputの責務、Outputには実装しない）

- OCR、OCR Provider
- 入力・確認画面
- 新規登録API、Google Sheets保存処理
- Apps Script、sidecar、入力用テスト・仕様書
- Input Spreadsheetへの書き込み全般

## データ

- 唯一の正本データはInput管理の `調査データ` タブ。列番号ではなく見出し名で解決する。
- 数値の欠測値は `0` に変換しない。
- `有効状態` が厳密に `有効` の行だけを分析・比較・予測の対象とする（空欄・`無効`・未知値は不採用）。

## 外部連携

| 接続先 | 用途 | 認証 | 権限 |
|---|---|---|---|
| Input正本 Spreadsheet（`調査データ`タブ） | 定期調査データの読取 | サービスアカウント（Reader共用） | 読取専用 |
| 予測原典 Spreadsheet（横径予測/糖度予測/酸度予測） | 予測係数の読取 | サービスアカウント（Reader共用） | 読取専用 |
| Output専用 正規化予測マスタ Spreadsheet | 予測モデルマスタ/予測係数マスタの読取・書込み | サービスアカウント（Reader / Writer別） | 読取（通常）、書込みはWriter Issue経由のみ |
| 気象データ CSV（公開Google Sheetsエクスポート） | 気象30日集計 | なし（公開URL、認証不要） | 読取専用 |

環境変数名は [README.md](README.md) の「環境変数」を参照してください。

## 非機能要件

- Input Spreadsheetへの書き込みを一切発生させない（アプリケーション全体の不変条件）。
- ブラウザへサービスアカウント秘密鍵を渡さない。
- Cloud Run稼働を前提に、認証失敗時に匿名GViz経路へフォールバックしない。

## 未決事項

- Cloud Run + IAPの実運用デプロイ時期（Cloud Billing、Artifact Registry、IAP、OAuth、IAM等の設定は別Issue）。
- npm audit High 4件への対応（`next@16`系メジャーアップグレード、Issue #97で計画中）。
- データ管理画面（`/data-management`）の要件は未定義（画面骨格のみ存在）。
- 詳細な定量的成功指標（[VISION.md](VISION.md) 参照）は未設定。
