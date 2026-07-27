# AGENTS.md

## 目的

このリポジトリは定期調査 Output 専用です。Input が管理する調査データを分析、比較、予測します。

## 境界

- Input は唯一の正本であり、Output は読取専用です。
- 参照するSpreadsheetタブは `調査データ` のみです。
- Input のコード、Spreadsheet、データ構造を変更してはいけません。
- OCR、入力、登録、保存、編集キー認証は Input の責務であり、実装してはいけません。
- 派生値、予測値、AIコメントを Input へ書き戻してはいけません。

## 開発ルール

- Issue に記載された範囲だけを実装します。
- 列番号ではなく見出し名でデータを解決します。
- 数値の欠測値を `0` に変換しません。
- 変更後は `npm run typecheck`、`npm run lint`、`npm test`、`npm run build` を実行します。
- `main` へ直接コミットしません。

連携仕様は `docs/analysis-data-interface-contract.md` を参照してください。
