# Prediction Master読取Repository契約

## 目的と境界

Output専用Spreadsheetの`予測モデルマスタ`と`予測係数マスタ`をサーバー側で読み、検証済み`PredictionMasterBundle`へ復元する。Repositoryは読取専用であり、Writer、Prediction Engine計算、Input Repository、UIを呼び出さない。

認証には既存Reader用の`GOOGLE_SERVICE_ACCOUNT_EMAIL`と`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`だけを使用し、OAuthスコープは`https://www.googleapis.com/auth/spreadsheets.readonly`に固定する。Writer資格情報、書込みスコープ、Driveスコープは使用しない。認証情報をブラウザーへ渡さない。

## 取得契約

- 公開入力は`spreadsheetId`と`expectedDataVersion`
- Spreadsheet IDと正式タイトル`定期調査Output予測マスタ`を照合
- 取得範囲は`予測モデルマスタ!A:H`と`予測係数マスタ!A:H`に固定
- Sheets APIはGETだけを使用（OAuth token取得のPOSTを除く）
- 外部から任意のシート名やA1範囲を受け取らない
- MVPではキャッシュしない

## Decoder契約

Decoderは環境変数、認証、HTTP、Google API、Writer、計算処理に依存しない純粋関数とする。正式見出し名から列位置を解決したうえで、見出しの欠落、重複、追加、順序変更、8列以外を拒否する。

文字列列は文字列、`有効`はbooleanの`true`、`推移係数`は有限かつ0より大きいnumberだけを受理する。文字列`TRUE`や数値文字列を変換しない。`選抜基準`と`引用年次`だけは空文字を保持し、その他の必須セル欠測を拒否する。行末の省略セルは欠測として扱う。末尾の未使用空行は無視するが、データ途中の完全空行は拒否する。

復元後に`validatePredictionMasters(bundle, expectedDataVersion)`を実行し、6モデル、既知指標、重複、版、生成日時、原典追跡、日別連続性、目標日係数を検証する。さらに取得順が正式順であることを確認し、順序違反を自動ソートしない。

## エラー保護

認証、権限、通信、target、タイトル、Decoder契約違反を判別可能なコードで報告する。秘密鍵、JWT、アクセストークン、Authorization、メールアドレス、Spreadsheet ID全体、全シート内容はエラーへ含めない。

## 対象外

- ReaderアカウントへのViewer付与と実Spreadsheet検証
- Spreadsheet書込み、ACL・IAM・Secrets変更
- Writer、Prediction Engine計算、Input、UIの変更
- キャッシュと本番利用開始
