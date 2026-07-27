# Output 実装状況

最終確認日: 2026-07-27

## 現在の骨格

| 区分 | 状態 |
|---|---|
| ホーム | 実装済み |
| 定期調査分析 | 画面骨格のみ |
| 園地分析 | 画面骨格のみ |
| 各種予測 | 横径・糖度・クエン酸の画面骨格のみ |
| データ管理 | 画面骨格のみ |
| Input連携契約 | 実装済み（`調査データ` 読取専用） |
| Prediction Engine | 未実装 |

## 除去した Input の責務

- OCR と OCR Provider
- 入力・確認画面
- 新規登録 API と Google Sheets 保存処理
- Apps Script、sidecar、入力用テストと仕様書

## 次の機能Issueへ進むための前提

次の機能Issueでは、`src/contracts/analysis-data.ts` を入口として、`調査データ` タブを読取専用で取得するアダプターを実装する。
Input側のコード、Spreadsheet、他タブを変更してはいけない。
