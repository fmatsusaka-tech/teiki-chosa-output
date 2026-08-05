# Prediction MVP 統合契約

Prediction MVPは、サーバー側でInput正本とOutput正規化Prediction Masterを各1回だけ読取り、検証済みBundleからモデル・係数Indexを構築して計算します。Reader認証は`spreadsheets.readonly`だけを使用し、Writer資格情報やSpreadsheet書込み処理を参照しません。

期待するPrediction Masterの版はサーバー専用環境変数`PREDICTION_MASTER_DATA_VERSION`から取得します。MVPは`1.0.1`を使用し、Spreadsheetの行から期待版を推測しません。

## モデル選択

品種はNFKC、括弧、連続空白を既存共通関数で正規化し、確定済みカテゴリーへ完全一致した場合だけ次のモデルを選択します。

| 品種カテゴリー | 予測モデル |
|---|---|
| ゆら早生 | ゆら早生 |
| 早生(宮川・興津 等、又は山下紅) | 興津早生 |
| 田口 | 田口早生 |
| 中生(向山など) | 向山温州 |
| 晩生 | 林温州 |
| 丹生系 | 丹生温州 |

部分一致や曖昧検索は行いません。

## 計算

横径は`averageDiameter`、糖度は`brix`、クエン酸は`acidity`を使用します。計測日とモデル既定目標日の`MM-DD`に完全一致する係数だけを使用し、補間・近似・外挿しません。計測日が目標日を超える場合は計算しません。

3指標は独立して計算し、1指標の欠測や係数欠落で他指標を停止しません。式、構造化計算失敗、丸めは既存Prediction Engine契約に従います。

## 画面

`/predictions`は品種・仮定日・横径/糖度/クエン酸の仮定値を利用者が自由入力する試算シミュレーターです（`prediction-dashboard.tsx`）。入力はGETクエリパラメータとして送信し、サーバー側は保存済みレコードを検索・一覧描画するのではなく、入力された仮定値のみを対象に`simulatePrediction`で計算します。入力内容はSpreadsheetにもサーバーにも保存しません。

結果として、品種・モデル、仮定日、既定収穫目標日、各指標の仮定値・予測値（または計算対象外の理由）、データ版をスマートフォンで確認できます。横径の予測値には、`src/features/shared/fruit-size.ts`の`getFruitSizeCategory`で判定した果実サイズ区分（3S/2S/S/M/L/2L/3L）を「64.2mm（M）」の形式で併記します。サイズ判定は表示用に丸める前の生の予測値で行い、下限を含み上限を含まない区分です。糖度・クエン酸の予測値、横径の実測値表示にはサイズ区分を付与しません。

`/predictions/diameter`・`/predictions/brix`・`/predictions/acidity`は、指標ごとに画面を分けていた旧構成の名残として`/predictions`へのリダイレクトのみを行います（旧URLの互換維持が目的で、独自の実装は持ちません）。
