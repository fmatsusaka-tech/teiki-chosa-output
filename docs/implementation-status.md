# Output 実装状況

最終確認日: 2026-07-27

## 現在の骨格

| 区分 | 状態 |
|---|---|
| ホーム | 実装済み |
| 定期調査分析 | 実データ接続済み（検索・年度比較・前回差） |
| 園地分析 | Phase 1実装済み（単一園地の時系列カルテ、連動検索・横スクロール対応） |
| 各種予測 | 横径・糖度・クエン酸の画面骨格のみ |
| データ管理 | 画面骨格のみ |
| Input連携契約 | 実装済み（`調査データ` 読取専用） |
| 調査データRepository | 実装済み（見出し名解決・変換・基本バリデーション） |
| Prediction Engine | 未実装（園地分析の予測列は `—` 表示のみ） |

## 除去した Input の責務

- OCR と OCR Provider
- 入力・確認画面
- 新規登録 API と Google Sheets 保存処理
- Apps Script、sidecar、入力用テストと仕様書

## 次の機能Issueへ進むための前提

次の機能Issueでは、`src/contracts/analysis-data.ts` を入口として、既存の `調査データ` 読取専用Repositoryを利用する。
Input側のコード、Spreadsheet、他タブを変更してはいけない。
