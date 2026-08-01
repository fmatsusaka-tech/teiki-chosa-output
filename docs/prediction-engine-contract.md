# Prediction Engine純粋計算契約

## 目的と境界

Prediction Engine純粋計算は、選択済みのPrediction Model、調査日係数、目標日係数と1つの調査値から、1指標の予測値を計算する。Google API、Spreadsheet、認証、Input Repository、モデル選択、係数検索、年度・期間判定、UIには依存しない。

入力は変更しない。Input正本、予測原典、Output正規化マスタへの書込みも行わない。

## 入力と式

入力は既存の`PredictionModelMaster`と`PredictionCoefficientMaster`を再利用し、指標、モデル名、調査値、調査月日、目標月日、期待する`dataVersion`を明示する。

式は3指標・6モデルで共通とする。

```text
rawPrediction =
  measuredValue
  × targetCoefficient.coefficient
  ÷ measuredCoefficient.coefficient
```

計算途中では丸めない。日付の前後関係、係数期間、目標年、目標日超過は統合層で判断し、純粋計算では判定しない。係数の検索、補間、近似、外挿も行わない。

## 検証と優先順

複数の不正がある場合は、次の順で最初の1件を構造化失敗として返す。

1. 調査値が有限かつ0より大きい
2. 調査日係数が有限かつ0より大きい
3. 目標日係数が有限かつ0より大きい
4. モデルが有効
5. 入力、モデル、両係数のモデル名が一致
6. 入力と両係数の指標が一致
7. 調査月日と調査日係数の月日が一致
8. 目標月日とモデル・目標日係数の月日が一致
9. モデル・両係数の`dataVersion`が期待値と一致
10. 計算結果が有限

エラーコードは`INVALID_MEASURED_VALUE`、`INVALID_MEASURED_COEFFICIENT`、`INVALID_TARGET_COEFFICIENT`、`INACTIVE_MODEL`、`MODEL_MISMATCH`、`METRIC_MISMATCH`、`MEASURED_MONTH_DAY_MISMATCH`、`TARGET_MONTH_DAY_MISMATCH`、`DATA_VERSION_MISMATCH`、`INVALID_PREDICTION_RESULT`とする。エラーへ入力全体や認証情報を含めない。

## 成功結果と原典追跡

成功結果は、指標、モデル、調査値、調査月日、調査日係数、目標月日、目標日係数、未丸め予測値、`dataVersion`を返す。両係数の`sourceSheet`と`sourceCell`も保持し、どの原典セルに基づいた計算か追跡可能にする。純粋計算結果にUI文言、単位、警告は含めない。

## 表示丸め

表示丸めは計算関数と分離し、内部の未丸め値を変更しない。

| 指標 | 表示桁 |
|---|---:|
| 横径 | 小数1桁 |
| 糖度 | 小数1桁 |
| クエン酸 | 小数2桁 |

MVPの丸めは`Number(raw.toFixed(digits))`相当とする。結果が`-0`なら`0`へ正規化する。非有限数は受け付けない。

## 対象外

- Input Repositoryと複数行処理
- Output正規化マスタReader
- 品種からのモデル選択
- 係数検索と日付判定
- Google API、認証、ACL、Spreadsheet書込み
- Writer変更
- 予測画面
