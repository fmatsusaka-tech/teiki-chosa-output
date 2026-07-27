# 定期調査 Output

Input が管理する `調査データ` タブを読取専用で利用し、定期調査データの分析・比較・予測を行うシステムです。

## 機能分類

- 定期調査分析
- 園地分析
- 各種予測（横径、糖度、クエン酸）
- データ管理

## 境界

- Input は唯一の正本であり、Output は更新しません。
- Output が参照するのは `調査データ` タブだけです。
- OCR、入力、登録、保存は Input の責務であり、このリポジトリには実装しません。

連携仕様は [Output 調査データ連携契約](docs/analysis-data-interface-contract.md) を参照してください。

## 開発

```text
npm run typecheck
npm run lint
npm test
npm run build
```
