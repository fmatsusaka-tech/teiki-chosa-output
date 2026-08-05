# Output 実装状況

最終確認日: 2026-08-05（AI Project Starter v4.5 既存プロジェクト導入時に更新）

## 現在の骨格

| 区分 | 状態 |
|---|---|
| ホーム | 実装済み |
| 定期調査分析 | 実装済み（実データ接続、検索・年度比較・前回差、有効状態フィルタ、横スクロール同期） |
| 園地分析 | 実装済み（単一園地の時系列カルテ、2園地比較、連動検索・横スクロール対応） |
| 各種予測（横径・糖度・クエン酸） | 実装済み（統合予測ダッシュボード。Prediction Engine + 気象データ + 仮定値シミュレーター。個別URL `/predictions/{diameter,brix,acidity}` は統合ダッシュボードへリダイレクト） |
| データ管理 | 画面骨格のみ（検索・確認機能は未実装） |
| Input連携契約 | 実装済み（`調査データ` 読取専用） |
| 調査データRepository | 実装済み（見出し名解決・変換・有効状態フィルタ・基本バリデーション） |
| Prediction Engine | 実装済み（純粋計算・仮定値シミュレーター統合済み） |
| Prediction Master Reader/Writer | 実装済み（Readerは通常経路、Writerは独立Issueで検証済みの書込み基盤） |
| Cloud Run + IAP ホスティング | 設計・Dockerfileは実装済み、実運用デプロイ（Cloud資源作成）は未実施 |

詳細な実装フェーズと今後の計画は [../ROADMAP.md](../ROADMAP.md)、技術的負債は同ファイルの「技術的負債」節を参照してください。

## 除去した Input の責務

- OCR と OCR Provider
- 入力・確認画面
- 新規登録 API と Google Sheets 保存処理
- Apps Script、sidecar、入力用テストと仕様書

## 次の機能Issueへ進むための前提

次の機能Issueでは、`src/contracts/analysis-data.ts` を入口として、既存の `調査データ` 読取専用Repositoryを利用する。
Input側のコード、Spreadsheet、他タブを変更してはいけない。
