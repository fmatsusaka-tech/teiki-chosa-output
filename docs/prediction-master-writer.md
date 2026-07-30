# Prediction Master Writer設計

## 認証境界

ReaderとWriterは別の認証主体を使用します。

Readerは既存の環境変数と読取専用スコープを維持します。

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `https://www.googleapis.com/auth/spreadsheets.readonly`

Writerだけが次の専用環境変数と書込みスコープを使用します。

- `PREDICTION_WRITER_SERVICE_ACCOUNT_EMAIL`
- `PREDICTION_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY`
- `https://www.googleapis.com/auth/spreadsheets`

Writer用サービスアカウントは、Output専用SpreadsheetだけをEditorとします。Input正本と予測原典SpreadsheetのEditorにはしません。Reader認証情報からWriter tokenを取得する経路、およびWriter認証情報からReader処理を実行する経路は設けません。

## 書込み先境界

Writer targetは環境変数`PREDICTION_MASTER_SPREADSHEET_ID`に固定し、正式タイトル`定期調査Output予測マスタ`との完全一致を検証します。Input正本ID、予測原典ID、APIから返されたIDとの不一致、禁止シート、正式2シートの片方だけの存在、既存見出し不一致を拒否します。

CLIから任意のSpreadsheet ID、シート名、A1範囲は受け取りません。

## 直接更新MVP

このMVPでは次を実装しません。

- ステージングシート
- ステージングから正式名への切替
- 自動バックアップ
- 自動ロールバック
- developer metadata
- 独自ロック

`予測モデルマスタ`と`予測係数マスタ`を、1回の`spreadsheets.batchUpdate`で直接更新します。Google Sheets APIがbatch内の全要求をまとめて検証・適用する性質を利用し、2シートを原子的に扱います。

batch成功後は正式2シートを再読込して完全一致を確認します。不一致でも自動再書込みや自動ロールバックは行いません。この場合、正式マスタが更新済みである可能性を残したまま失敗として報告します。

初回実書込みは検証専用Output Spreadsheetだけで行います。本番利用開始には、独立した運用検証とユーザー承認が必要です。

## timeout・通信切断時の保全

batch送信前の認証失敗や事前通信失敗は未適用として終了し、再読込しません。

batch送信開始後にtimeoutや通信切断で応答を確認できない場合は、適用状態不明として扱います。

1. 同じbatchを自動再送しない
2. 正式2シートを再読込する
3. 期待値と完全一致すれば`適用済み・再確認成功`とする
4. 不一致、または再読込失敗なら状態不明のまま終了する
5. 状態不明を通常成功として報告しない

状態不明エラーには、秘密鍵、JWT、アクセストークン、Authorizationヘッダー、Spreadsheet ID全体、期待値・実値の全内容を含めません。

## 実行条件

- `--data-version`は必須
- `--execute`がない場合は書込み0回
- シリアライズ前にPrediction Master Preflightを実行
- batch成功または状態不明後の再確認成功時に、再読込完全一致を完了条件とする
- 自動リトライ・自動再書込みを行わない
