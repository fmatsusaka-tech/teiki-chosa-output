# teiki-chosa-output リポジトリ総点検レポート

- 監査対象コミット: `53b306c`（origin/main, 2026-08-04時点）
- 監査方法: 独立した2体のサブエージェントによる並行監査（エージェントA＝バグ・動作破綻監査／エージェントB＝設計・保守性監査）＋統括役による統合。両エージェントとも `AGENTS.md` / `README.md` / `docs/*` / `src/` / `scripts/` 全体の読解、`git log` によるホットスポット分析、`gh issue list` によるOpen issueとの突合、`npm run lint / typecheck / test / build` および `npm audit` の実行を行った。
- **本レポートの指摘内容自体は、コードを一切変更せずに作成した時点のスナップショットである。**

## 追記（2026-08-04・ユーザー承認後の対応）

ユーザー承認のうえ、以下を実施済み。

- Issue化候補11件のうち、既存Issue(#85/#22/#72)でカバーされない10件を新規起票（#89〜#98）。
- Phase 0（緊急修正）3件をブランチ→PR→CI通過確認→マージの手順で本番反映済み。
  - CR-1 `optionalString`の型対応 → PR #99（Closes #85）
  - CR-2 非認証GViz読取コード削除・ハードコードID除去 → PR #100（Closes #89。監査時に見つかっていなかった`scripts/write-prediction-masters.ts`内の同一IDフォールバックも合わせて削除）
  - H-4 Prediction Masterのcache設定追加 → PR #101（Closes #94）

Phase 1・Phase 2、および処理区表記ゆれ統一（H-1, Issue #90）等の残り指摘は未着手。

---

## 1. 結論

`teiki-chosa-output` は lint・typecheck・453件のテスト・buildがすべてクリーンで、「表面的に壊れているコード」は見当たらない。一方で、**実運用データでのみ顕在化する静かなデータ欠落バグが1件、現在も本番で発生し続けている（Issue #85, Critical）**。また、**公開GitHubリポジトリに本番Input正本のSpreadsheet IDがハードコードされたまま残存しており（Issue #22と直結, Critical）**、セキュリティ上の懸念がある。この2件は最優先で対応すべきである。

これらを除けば、残る指摘の大半は「壊れている」ではなく「変更に弱い／同じ問題が形を変えて再発しやすい」という**構造的なつぎはぎ**に分類される。特に、品種名の表記ゆれは既に一度修正されたにもかかわらず（コミット `53b306c` 自体がその修正）、同じパターンの表記ゆれバグが処理区（treatment）に未修正のまま残っている点は、このリポジトリの改修が「対症療法の積み重ね」になっていることを象徴している。

全体として、**現時点で本番利用を止める必要はないが、Critical 2件は今週中の対応を推奨**する。

## 2. 現在の健全性評価

| 観点 | 評価 | 根拠 |
|---|---|---|
| ビルド・型・Lint | 良好 | `tsc --noEmit`・`eslint .` ともにエラー0件 |
| テスト | 良好（範囲に注意） | 33ファイル / 453テストすべて成功。ただしSheets APIの型揺れ（数値/真偽値セル）・処理区の表記ゆれ・年/調査基準月の不一致など、**実運用データ特有の異常系**を再現するテストが不足している |
| 依存関係のセキュリティ | 要計画的対応 | `npm audit --production` で High 3件（`postcss`, `sharp`。`next` の推移依存）。修正には `next@16` へのメジャーアップグレードが必要。`images: { unoptimized: true }` のため実際の攻撃可能性は限定的と推測される |
| 秘密情報管理 | 概ね良好 | APIキー・秘密鍵のハードコードは検出されず、`.env*` は `.gitignore` 済み。ただし後述の通りSpreadsheet ID（識別子）のハードコードは残存 |
| アーキテクチャ境界の遵守 | 良好 | `AGENTS.md` が定める「Input読取専用」「Writerは独立Issue経由」という境界は、実装（GETのみ使用、スコープ固定、Prediction Master Writerがどのページからも呼ばれていない）と整合していた |
| ドキュメントと実装の整合 | 要更新 | `docs/implementation-status.md` と `docs/prediction-mvp.md` が実装から取り残されている（詳細は5章） |
| 変更のしやすさ | 要改善 | 処理区正規化・日付パース・Google Sheets認証ロジックが複数箇所に分散コピペされており、1箇所の修正だけでは整合しない構造になっている |

## 3. Critical / Highの問題

### CR-1（Critical）調査データの自由記述欄が数値/真偽値としてSheets APIから返ると、その行が無警告で分析から消える

- **対象**: `src/repositories/analysis-data-repository.ts` `optionalString`（131-139行目）、`requiredString`（123-129行目）、`getAll`（20-56行目）
- **症状**: 「備考」「園地名」「品種」「処理区」など`optionalString`/`requiredString`を経由する列に、書式指定のないセルへ数字だけ（例: `1`）や`TRUE`/`FALSE`的な内容が入力されると、Google Sheets APIはそれを`numberValue`/`boolValue`として返す。現行実装は`typeof value !== "string"`で無条件に例外を投げるため、その行はUIに一切警告を出さないまま分析・比較・予測から欠落する。全行がこの条件に該当すると「調査データを取得できませんでした。接続設定を確認してください。」という**誤った原因表示**になる。
- **再現条件**: 自由記述欄（特に「備考」）に数字のみ・真偽値的な内容を、テキスト書式指定なしで入力・保存。
- **根拠**: **Open Issue #85**「調査データの備考欄が数値のときに分析全体が失敗する」に実際のCloud Runログが引用されている（`調査データ 186行目の「備考」を文字列へ変換できません。`）。データは不正ではなく正当な利用者入力であることが明記されている。`analysis-data-repository.test.ts`にnumberValue/boolValueを渡すケースのテストは存在しない。コミット`7ad2cc5`で1行スキップ時の全体クラッシュは緩和されたが、根本原因の型拒否自体は未修正。
- **推奨修正**: `optionalString`/`requiredString`が`number`/`boolean`を`String(value)`で文字列化してから返すようにする（Issue #85の対応方針通り）。行スキップ発生時は件数をページ側の戻り値に伝播し、他機能同様にUIへ警告バナーを出す。
- **追加すべきテスト**: `optionalString`/`requiredString`に`numberValue`（`1`, `0`）・`boolValue`（`true`/`false`）を渡した場合に文字列化される単体テスト。行スキップ時にページ側戻り値へ件数/警告が伝播する統合テスト。
- **エージェント間の一致**: エージェントA（Critical）・エージェントB（High-2）ともに独立に同一箇所を最重要級として検出。両者に相違なし。

### CR-2（Critical）公開リポジトリに未使用の非認証Sheets読取コード＋本番Input正本のSpreadsheet IDがハードコードされたまま残存

- **対象**: `src/repositories/google-sheets-analysis-data-source.ts`（4-5行目ほか全体）
- **症状**: `GoogleSheetsAnalysisDataSource`はIAP/サービスアカウント認証を経由しないGViz非認証読取実装。実運用の`src/app/analysis/page.tsx`は認証付きの`GoogleSheetsApiAnalysisDataSource`のみを使用しており、このクラス自体は実行経路から到達不能（自身のテストからしか参照されない）。しかしコード内に本番Input正本のSpreadsheet ID `1Ix7qFigeUvmxkEl3C51rmzuBzYDq7OR_ZGHq6GUKa0g` とシートgidがフォールバック値としてハードコードされており、`gh repo view --json visibility` で確認した通り本リポジトリは **Public** である。
- **再現条件**: リポジトリを閲覧するだけで該当IDが読める。実際の悪用可能性はInput正本SpreadsheetのGoogle Drive ACLに依存する。
- **根拠**: **Open Issue #22**「security: Input正本の公開GViz依存を認証付き読取へ移行する」に、まさに本ファイルが影響範囲として明記されており、コメントには「匿名Editorから匿名Viewerへ変更したが機密性は未解消」「恒久案にはせず暫定措置」と記載されている＝**誰でもリンクを知れば閲覧可能な状態が現在も続いている**ことをIssue自体が認めている。
- **推奨修正**: 実行経路から到達不能であることを確認済みのため、`google-sheets-analysis-data-source.ts`と対応テストを削除し、ハードコードされたIDを公開リポジトリから除去する。Issue #22本体（Input側Drive ACLの最終確認）はOutput側のコード変更だけでは完結しないため、ユーザー側での確認・クローズが必要。
- **追加すべきテスト**: 不要（削除対象）。削除後、認証なし読取経路がどこからも到達不能であることを保証する仕組み（未使用exportの検知強化等）を検討する価値あり。
- **エージェント間の見解相違と統括結論**: エージェントAはこれを**Critical**（公開リポジトリ上のSpreadsheet ID露出＋Issue #22との直結を根拠）と評価した。一方エージェントBは同じファイルを**Low-1**（`docs/analysis-data-interface-contract.md`が「ロールバック候補として意図的に残置、Cloud Run安定稼働確認後に別Issueで削除」と明記しており、実行経路から到達不能で実害は限定的、との理由）と評価した。
  → **統括判断：Critical寄りのHighとして扱い、Phase 0での早期対応を推奨する。** 理由は、(1) このコードが「意図的な残置」であることはドキュメント上の設計判断として妥当だが、それとは独立に「Spreadsheet IDが公開リポジトリにハードコードされている」という事実自体がIssue #22が指摘する未解消のセキュリティ課題そのものであること、(2) Issue #22のコメントが「匿名Viewerでも機密性は未解消」と明言している以上、IDの公開性そのものが実害に直結し得ること。エージェントBの指摘（ドキュメント上は意図的な残置）は「削除してよいタイミングの判断根拠」として採用しつつ、削除自体は先送りしない方針とする。

### H-1（High）定期調査分析の「前回差」計算が処理区の表記ゆれ・空欄を同一視せず、品種で一度直った同種バグが処理区で再発している

- **対象**: `src/features/periodic-analysis/periodic-analysis.ts` `previousDifference`（71-76行目、`candidate.record.treatment === current.record.treatment`が完全一致比較）
- **症状**: 同一園地・同一品種カテゴリーでも、処理区欄が今回は空欄・前回は`"無処理区"`（またはその逆）だと前回差が本来算出可能でも`null`（`—`表示）になる。
- **根拠**: 品種については本監査対象コミット`53b306c`自体で「『ゆら』と『ゆら早生』のような表記ゆれで前回差が出なくなる問題を解消する」修正が入ったばかり。一方`src/features/orchard-analysis/orchard-analysis.ts`には空欄・`無処理区`・`処理区なし`を同一視する`normalizeTreatment`が既に存在するが、`periodic-analysis.ts`はこれを一切importしていない。**Open Issue #72**が「空欄と`無処理区`を混同していないか」を未確認事項として明記しており、かつ「`無処理区`は明示された業務値であり空欄とは別」とも述べているため、**そもそも同一視すべきかどうかの業務判断自体が確定していない**。
- **推奨修正**: 実装より先に、Issue #72の論点（空欄と`無処理区`を同一視してよいか）を業務判断として確定する。確定後、`normalizeTreatment`相当の関数を`shared`配下に共通化し、`periodic-analysis.ts`・`orchard-analysis.ts`・`orchard-name-master.ts`で挙動を統一する。
- **追加すべきテスト**: 処理区が「空欄 vs 無処理区」「空欄 vs 処理区なし」のケースでの前回差テスト。
- **エージェント間の一致**: エージェントA（High-1）・エージェントB（Medium-2）が同一箇所を独立検出。重要度表記はAが上、Bが下だが、実質同一指摘であり相違ではない。→ 統括判断：**再発パターンかつOpen issueに未確定の業務判断として残っている**ことを重く見てHighとする。

### H-2（High）Google Sheets JWT認証・OAuthトークン取得ロジックが5ファイルに個別コピペされている

- **対象**: `src/server/analysis-data/google-sheets-api-analysis-data-source.ts`（57-132行）、`src/server/orchard-master/google-sheets-orchard-name-master-repository.ts`（27-56行）、`src/server/prediction-data/google-sheets-prediction-master-repository.ts`（62-141行）、`scripts/lib/google-sheets-reader.ts`（27-71行）、`scripts/lib/google-sheets-writer.ts`
- **問題**: JWTアサーション生成→トークン取得→レスポンス検証という一連の処理がほぼ同一ロジックとして5箇所に独立実装され、検証条件もファイルごとに微妙に異なる。
- **なぜ壊れやすいか**: 認証まわりの変更（トークンキャッシュ、スコープ変更、鍵ローテーション、エラーメッセージ統一等）は本来1箇所で完結すべきだが、現状は5箇所を同時に直さないと整合性が崩れる典型的なShotgun Surgery。認証系のバグは可用性・セキュリティに直結する。
- **改善案**: 共通モジュール（例: `src/server/google-sheets/`）にJWTアサーション生成・トークン取得・型ガードを切り出し、各Repository/DataSourceは戻り値の扱いだけを担当する。scripts側とsrc/server側でtsconfigが異なる点、Reader/Writerの資格情報分離方針（AGENTS.md）を壊さない点に注意。
- **小さく安全に直す順序**: (1) 共通関数を新規ファイルに抽出し1本だけ置き換えてテスト確認 → (2) 残り3本を1本ずつ置き換え → (3) 各ファイル固有のエラーコード分類は残したまま認証処理のみ共通化。

### H-3（High）`periodic-analysis-client.tsx`にUI・列定義・表示ロジックが密結合し、最も頻繁に変更される中核ファイルになっている

- **対象**: `src/app/analysis/periodic-analysis-client.tsx`（170行、`columns`定義41-60行）
- **問題**: 列の見出し・幅・色分け・小数桁・予測結果マッピングを定義する`columns`が、Reactコンポーネント本体・スクロール同期・フィルタstateと同一ファイルに混在。
- **なぜ壊れやすいか**: `git log --stat`で`globals.css`（24回）に次いで**16回**変更されている最多クラスのファイル。実コミット履歴は「処理区を2段表示」「備考列を追加」「日付列を並び替え」等、表示調整レベルの変更ばかりだが、その都度モノリシックなファイルへ直接手を入れている。
- **改善案**: 列定義を`src/features/periodic-analysis/periodic-analysis-columns.ts`等へ切り出し、コンポーネントは描画に専念させる。
- **小さく安全に直す順序**: (1) `columns`と表示ヘルパーをロジック変更なしで新規ファイルへ移動 → (2) importに置き換えてテスト・実画面確認 → (3) 以降の列調整は新モジュールのみで完結。
- **副作用**: `rainfall30Days`/`temperature30Days`等、Context依存の列があるため依存関係の維持に注意。

### H-4（High、要検証）Prediction Masterの取得だけ`cache: "no-store"`が付与されておらず、他の全読取経路と一貫していない

- **対象**: `src/server/prediction-data/google-sheets-prediction-master-repository.ts` `read`内fetch呼び出し（184-189行目）
- **問題**: 同種の他3ファイル（`google-sheets-api-analysis-data-source.ts`, `google-sheets-orchard-name-master-repository.ts`, `kisho-weather-repository.ts`）はすべて明示的に`cache: "no-store"`を指定しテストで検証しているが、Prediction Masterのfetchだけこれを欠く。`git log --follow -p`で確認した限り実装当初からの漏れであり、リグレッションではない。
- **症状**: Prediction Master側の係数・モデルが更新された後も、古い係数がしばらく表示され続ける可能性がある（Next.js/Node fetchの実装詳細に依存するため実際の影響度は要検証）。
- **推奨修正**: 他3リーダーと同様に`cache: "no-store"`を明示指定する。
- **追加すべきテスト**: fetch呼び出しの第2引数に`cache: "no-store"`が含まれることを検証するテスト。

## 4. Medium / Lowの問題

### Medium

| ID | 内容 | 対象 | 出典 |
|---|---|---|---|
| M-1 | 前回差の「同一年判定」が表示用`periodYear`（調査基準月由来）と生列「年」という異なる情報源を使っており、年またぎレコードで不整合の恐れ | `periodic-analysis.ts` 72, 106行目 | A |
| M-2 | 横径の「旧OCR一桁補正」（100〜999を無条件で1/10）が新旧データを区別せず恒久適用、発動件数の可視化なし | `analysis-data-repository.ts` `optionalDiameter`（359-366行） | A |
| M-3 | 園地マスタ適用失敗の原因（認証エラー/契約違反等）が一律の汎用警告に丸められ、運用時の原因切り分けができない | `normalized-analysis-records.ts`（6-19行） | A |
| M-4 | `登録日時`と`計測日`の日付正規化ロジック（GViz形式/ISO/シリアル値等4パターン解析）が約150行の大半で複製 | `analysis-data-repository.ts` `optionalRegisteredAt`/`optionalMeasuredAt` | B |
| M-5 | `docs/implementation-status.md`・`docs/prediction-mvp.md`が実装と乖離（予測は「未実装」と書かれているが実際は実装済み、`/predictions`の設計記述も実態と異なる） | `docs/implementation-status.md`, `docs/prediction-mvp.md` | B |
| M-6 | `globals.css`（262行）が全画面共有の非スコープCSSで、リポジトリ最多の24回変更 | `src/app/globals.css` | B |
| M-7 | `NormalizedAnalysisDataRecord.originalOrchard`が型として伝播されず、`in`演算子による実行時ダックタイピングに依存 | `periodic-analysis.ts` `toRow`（109行）、`periodic-analysis-client.tsx`（98行） | B |

### Low

| ID | 内容 | 対象 | 出典 |
|---|---|---|---|
| L-1 | `docs/periodic-analysis-design.md`が品種判定ロジックの正規化修正（`53b306c`）に追随していない | `docs/periodic-analysis-design.md` 37行目 | A |
| L-2 | `npm audit` High 3件（`postcss`/`sharp`、`next`推移依存）。`next@16`への計画的アップグレードが必要 | package依存 | A |
| L-3 | `variety-category.ts`の互換再エクスポート経由のimportが一部だけ残存し、移行完了か意図的APIか不明瞭 | `periodic-analysis/variety-category.ts`ほか | B |
| L-4 | `@deprecated`とマークされた未使用export（`isIncludedInStandardAnalysis`）が削除されず残存 | `src/contracts/analysis-data.ts` 79-82行目 | B |

## 5. 設計上のつぎはぎ

- **正規化ロジックの分散**: 品種カテゴリーは`shared/variety-category.ts`に一本化済みだが、処理区の表記ゆれ正規化（`normalizeTreatment`）は`orchard-analysis.ts`にしか存在せず、`periodic-analysis.ts`には適用されていない（H-1）。同じ「表記ゆれ」という業務課題への対応が画面ごとにバラバラ。
- **認証コードの並行実装**: Google Sheets JWT認証が5ファイルに個別実装（H-2）。
- **日付パースロジックの並行実装**: 登録日時／計測日で約150行の大半が重複（M-4）。
- **UIと集計・表示ロジックの結合**: `periodic-analysis-client.tsx`が列定義・色分け・表示フォーマットとReact本体を一体化し、最多変更ファイルの一つになっている（H-3）。
- **旧仕様の残骸**: `/predictions/diameter`等3画面がすべて`redirect("/predictions")`のみの旧構成の残骸（M-5関連）。GViz非認証読取実装も「ロールバック候補」として意図的に残置されているが、削除タイミングを追跡するIssueが存在しない（CR-2/L相当）。
- **ドキュメントと実装の乖離**: `docs/implementation-status.md`・`docs/prediction-mvp.md`が実装から取り残されている（M-5）。このリポジトリはAIエージェント主導開発でdocsがオンボーディング資料として機能する前提のため、放置すると次の改修が誤った前提で行われるリスクがある。

## 6. 不足しているテスト

- `optionalString`/`requiredString`に`numberValue`/`boolValue`を渡した場合の単体テスト（CR-1）。
- 処理区が「空欄 vs 無処理区」「空欄 vs 処理区なし」の前回差テスト（H-1、業務判断確定後）。
- `record.year`と`surveyMonth`の年部分が異なるレコードに対する`buildPeriodicAnalysis`の挙動テスト（M-1）。
- Prediction Masterのfetch呼び出しに`cache: "no-store"`が含まれることを検証するテスト（H-4）。
- 行スキップ発生時にページ側戻り値へ件数/警告が伝播することを検証する統合テスト（CR-1関連）。

lint/typecheck/453テストはクリーンだが、これらはいずれも「Sheets APIという外部システムの型揺れ」「業務上の表記ゆれ」「年月の複数情報源の不一致」という、**実運用データでしか顕在化しないカテゴリ**であり、既存テストスイートの死角になっている。

## 7. セキュリティ・運用上の懸念

- **CR-2**（公開リポジトリへのSpreadsheet IDハードコード、Issue #22と直結）が最大の懸念。
- `npm audit` High 3件（`postcss`/`sharp`、`next`推移依存）。緊急性は限定的（`images: unoptimized: true`のため`sharp`の実経路利用は薄い）だが、`next@16`への計画的アップグレードを別Issueとして追跡すべき。
- 秘密情報のハードコード（APIキー・秘密鍵）は検出されず、`.env*`は`.gitignore`済み。認証境界（Reader/Writer分離、Input読取専用）はコード上守られていた。
- 本番はCloud Run + IAPで保護され継続的デプロイ（main push→即デプロイ）が組まれているため、**mainへの変更は即座に本番へ反映される**。CR-1のような静かなデータ欠落バグは、本番Cloud Runログを見ない限り運用者が気づけない構造になっている点も運用上の懸念。

## 8. 改善優先順位

1. CR-1（データ欠落、本番で発生中）
2. CR-2（公開リポジトリのID露出、セキュリティ）
3. H-1（処理区の表記ゆれ、再発パターン）
4. H-4（キャッシュ設定漏れ、実害要検証だが直しやすい）
5. H-2（認証コード5重化、変更のたびに壊れるリスク）
6. H-3（`periodic-analysis-client.tsx`の密結合、変更頻度最多）
7. Medium群（M-1〜M-7）
8. Low群（L-1〜L-4）

## 9. Phase 0：緊急修正

- CR-1: `optionalString`/`requiredString`に数値/真偽値許容を追加（Issue #85対応）。
- CR-2: 未使用の`google-sheets-analysis-data-source.ts`とテストを削除し、ハードコードされたSpreadsheet IDを除去。Issue #22のクローズ判断をユーザー側で実施。
- H-4: `google-sheets-prediction-master-repository.ts`のfetchに`cache: "no-store"`を追加（1行修正、副作用ほぼなし）。

## 10. Phase 1：安全な整理

- L-1: `docs/periodic-analysis-design.md`を実装（正規化された品種カテゴリー判定）に合わせて更新。
- M-5: `docs/implementation-status.md`・`docs/prediction-mvp.md`を実装に合わせて更新。
- L-3: `variety-category.ts`の互換再エクスポート経由importを直接importに揃え、互換レイヤを削除。
- L-4: 未使用の`@deprecated` export `isIncludedInStandardAnalysis`を削除。
- L-2: `next@16`アップグレードを独立Issueとして追跡（実装はPhase 1では行わず計画のみ）。

## 11. Phase 2：構造改善

- H-1: 処理区の表記ゆれ同一視の業務判断を確定した上で、`normalizeTreatment`を`shared`へ共通化し`periodic-analysis.ts`にも適用。
- H-2: Google Sheets JWT認証ロジックを共通モジュールへ段階的に集約（1本ずつ置き換え）。
- H-3: `periodic-analysis-client.tsx`の列定義を独立モジュールへ切り出し。
- M-4: 日付正規化ロジック（登録日時/計測日）の共通抽出関数化。
- M-6: 変更頻度の高い画面から`globals.css`をCSS Modules化。
- M-7: `PeriodicAnalysisClient`のprops型を`NormalizedAnalysisDataRecord`に揃え、`in`演算子によるダックタイピングを解消。
- M-1, M-2, M-3: 年判定の情報源統一、OCR補正の可視化、園地マスタ失敗理由の構造化ログ化。

## 12. 今は触らない方がよい箇所

- **Prediction Engine（`prediction-engine.ts`）・統合層（`prediction-integration.ts`）・Writer（`prediction-master-writer.ts`）**: 両エージェントとも、モデル/係数/指標/月日/データ版の不一致を構造化エラーとして検出しており、責務分離・原子的更新の考慮もしっかりしていると評価。AGENTS.mdが定める「Writer以外から直接更新してはいけない」境界も守られている。現時点で構造上の懸念は見つかっていないため、他Phaseの修正で誤って巻き込まないよう注意する。
- **`weather-30-day.ts`の30日集計**: 欠測日・重複日・不正日付をすべて明示的な`ok: false`として返しており、欠測を0へ変換するような危険な扱いは見当たらなかった。触る必要はない。
- **`isIncludedInAnalysis`本体（`analysis-data.ts`）**: `@deprecated`な旧関数（L-4）とは別に、現行の判定ロジック自体には問題は見つかっていない。

## 13. Issue化候補一覧

| # | タイトル案 | 優先度 | 備考 |
|---|---|---|---|
| 1 | `optionalString`が数値/真偽値セルで例外を投げデータが消える | Critical | **既存Issue #85が該当。新規不要、対応を最優先で進める。** |
| 2 | 公開リポジトリの非認証GViz読取コード削除とSpreadsheet ID除去 | Critical | 既存Issue #22と関連するが、Output側コード削除は新規Issueとして切り出すことを推奨（Issue #22はInput側ACLの話が中心のため） |
| 3 | 定期調査分析の前回差で処理区の表記ゆれ・空欄を同一視するか業務判断を確定する | High | 既存Issue #72の未確認事項に該当。新規Issue化推奨（業務判断＋実装は分けて追跡） |
| 4 | Google Sheets JWT認証ロジックの共通化（5ファイル重複解消） | High | 新規Issue |
| 5 | `periodic-analysis-client.tsx`の列定義を独立モジュールへ分離 | High | 新規Issue |
| 6 | Prediction Master fetchに`cache: "no-store"`を追加 | High | 新規Issue（小さいので単独で早期クローズ可能） |
| 7 | `docs/implementation-status.md`・`docs/prediction-mvp.md`を実装に合わせて更新 | Medium | 新規Issue |
| 8 | 日付正規化ロジック（登録日時/計測日）の共通化 | Medium | 新規Issue |
| 9 | `globals.css`の段階的CSS Modules化 | Medium | 新規Issue（着手は任意、優先度低め） |
| 10 | `next@16`メジャーアップグレード計画 | Low | 新規Issue（npm audit起因） |
| 11 | `variety-category.ts`互換レイヤの削除、`@deprecated` export削除 | Low | 新規Issue（まとめて1件でも可） |

---

*本レポートはエージェントA（バグ・動作破綻監査）とエージェントB（設計・保守性監査）による独立並行調査結果を、統括役が比較・統合して作成した。両エージェントの個別詳細レポートはセッションのスクラッチ領域に保存されており、本ドキュメントには主要な根拠・コード引用を再掲済みである。*
