# Output 実装状況

最終確認日: 2026-08-05

## 現在の骨格

| 区分 | 状態 |
|---|---|
| ホーム | 実装済み |
| 定期調査分析 | 実データ接続済み（検索・年度比較・前回差・収穫時予測列・30日気象集計） |
| 園地分析 | 実データ接続済み（単一園地の時系列カルテ、連動検索・横スクロール対応・2園地比較） |
| 各種予測 | 実データ接続済み（`/predictions` の仮定値シミュレーターで横径・糖度・酸度の収穫時予測を試算。詳細は `docs/prediction-mvp.md`） |
| データ管理 | 実データ接続済み（分析対象から除外されている行を理由付きで一覧表示する開発者用データチェック機能） |
| Input連携契約 | 実装済み（`調査データ` 読取専用） |
| 調査データRepository | 実装済み（見出し名解決・変換・基本バリデーション） |
| Prediction Engine | 実装済み（予測モデルマスタ・予測係数マスタから収穫時予測を計算し、定期調査分析・各種予測画面へ統合） |
| Prediction Master Writer | 実装済み（CLIスクリプト経由。Reader/Writer資格情報分離、原子的batch更新、状態不明時のフェイルセーフ対応。詳細は `docs/prediction-master-writer.md`） |

## 除去した Input の責務

- OCR と OCR Provider
- 入力・確認画面
- 新規登録 API と Google Sheets 保存処理
- Apps Script、sidecar、入力用テストと仕様書

## 次の機能Issueへ進むための前提

次の機能Issueでは、`src/contracts/analysis-data.ts` を入口として、既存の `調査データ` 読取専用Repositoryを利用する。
Input側のコード、Spreadsheet、他タブを変更してはいけない。
