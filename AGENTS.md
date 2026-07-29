# AGENTS.md

## 目的

このリポジトリは定期調査 Output 専用です。Input が管理する調査データを分析、比較、予測します。

## Spreadsheet 境界

「Output は読取専用」とは、Input が管理する正本調査データに対して完全な読取専用であることを意味します。Spreadsheet の用途ごとに、次の境界を守ってください。

### Input の正本 Spreadsheet

- Input は調査データの唯一の正本です。
- Output から Input Spreadsheet へのアクセスは完全な読取専用です。
- Output が Input Spreadsheet で参照できるタブは `調査データ` だけです。他のタブは参照しません。
- Input Spreadsheet のいかなるタブ・セルにも書き込んではいけません。
- Input のコード、データ構造、見出しを変更してはいけません。
- OCR、入力、登録、保存、編集キー認証は Input の責務であり、実装してはいけません。
- 派生値、予測値、AIコメントを Input へ書き戻してはいけません。

### 予測原典 Spreadsheet

- `横径予測`、`糖度予測`、`酸度予測` は予測原典 Spreadsheet 上の読取専用シートです。
- 原典シートを変更、削除、補正してはいけません。
- Prediction Master Reader は認証スコープ `https://www.googleapis.com/auth/spreadsheets.readonly` だけを使用します。
- 原典の空白セル、物理位置、係数、数式を変更せず、そのまま読み取ります。

### Output 専用の正規化予測マスタ

- `予測モデルマスタ` と `予測係数マスタ` は Output 専用の派生マスタであり、Input の正本データではありません。
- 書込みは、独立した Prediction Master Writer Issue で定義・検証された Writer だけに許可します。
- 正規化予測マスタは、検証済みの Prediction Master Reader 出力だけを生成元とします。
- Writer 以外の UI、分析処理、Prediction Engine から直接更新してはいけません。
- Writer は失敗時に既存マスタを破損させない設計とします。
- Google Sheets の書込み権限を含む権限拡大は、Writer Issue の着手時に限定して判断します。

## 開発ルール

- Issue に記載された範囲だけを実装します。
- 列番号ではなく見出し名でデータを解決します。
- 数値の欠測値を `0` に変換しません。
- 変更後は `npm run typecheck`、`npm run lint`、`npm test`、`npm run build` を実行します。
- `main` へ直接コミットしません。

連携仕様は `docs/analysis-data-interface-contract.md` を参照してください。
