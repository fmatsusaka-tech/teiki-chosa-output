# 認証付きAnalysis DataSource契約

## 責務

`GoogleSheetsApiAnalysisDataSource`は、Input正本Spreadsheetの`調査データ`タブだけをサーバー側で読み取り、Google Sheetsのセル値を`AnalysisDataRepository`へ渡す。見出し解決、日付・数値・欠測の業務検証は既存Repositoryの責務とする。

## 認証境界

- 既存Reader用の`GOOGLE_SERVICE_ACCOUNT_EMAIL`と`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`を使用する。
- targetは`ANALYSIS_DATA_SPREADSHEET_ID`で必須指定し、既定IDへフォールバックしない。
- OAuthスコープは`https://www.googleapis.com/auth/spreadsheets.readonly`に固定する。
- Input正本への権限はViewerだけとし、Writer資格情報、書込みスコープ、Driveスコープを使用しない。
- 認証情報を`NEXT_PUBLIC_`変数やブラウザーへ渡さない。

JWT処理は変更範囲を小さく保つため本DataSource内へ独立実装する。Prediction Master Repositoryの既存認証処理は変更しない。将来共通化する場合も、読取専用スコープだけを発行できるサーバー専用処理とする。

## 取得・照合

- Google Sheets APIの`spreadsheets.get`をGETで使用する。
- 取得範囲はサーバー側で`'調査データ'`へ固定する。
- API応答のSpreadsheet ID、正式タイトル`定期調査データバンク`、シートタイトル`調査データ`をすべて照合する。
- `調査データ`以外のシート、任意のID、任意のA1範囲を公開入力として受け取らない。
- 認証または取得失敗時に公開GVizへ自動フォールバックしない。

## Google値型

`effectiveValue`の`stringValue`、`numberValue`、`boolValue`を、それぞれ同じTypeScript型へ復元する。値なしと省略された行末セルは欠測として扱い、0へ変換しない。数値文字列やbooleanをnumberへ暗黙変換せず、`formattedValue`も業務値として使用しない。入力順を変更しない。

## エラーとログ

設定、認証、アクセス拒否、通信、target、タイトル、シート、応答構造を構造化エラーで区別する。秘密鍵、JWT、token、メールアドレス、Spreadsheet ID全体、API応答本文、登録ID、園地名、個別セル値をエラーやログへ含めない。

## 現段階の制限

本Issueでは既存GViz DataSourceを削除せず、分析画面・園地分析画面も切り替えない。Input正本へのReader Viewer追加、実Spreadsheet読取、Cloud Run Secrets、匿名Viewer解除は後続の運用Issueで扱う。
