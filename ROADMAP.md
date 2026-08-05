# ROADMAP.md

実装済みIssue履歴（Git log）から復元した実装フェーズです。今後のフェーズは既存Open Issueと[docs/audit/REPOSITORY_AUDIT.md](docs/audit/REPOSITORY_AUDIT.md)（2026-08-04付け全体監査）に基づきます。

## 完了フェーズ（実装済み）

- Phase 0: Next.js開発基盤（App Router、TypeScript、Vitest、ESLint）
- Phase 1: Output専用基盤・定期調査分析・園地分析の骨格
- Phase 2: Prediction Master Reader（予測係数マスタ読取基盤）
- Phase 3: Prediction Master Writer基盤（独立資格情報・失敗時非破壊設計）
- Phase 4: Prediction Engineの純粋計算実装
- Phase 5: Input正本の認証付きAnalysis DataSource実装、分析画面の認証付き読取への切替
- Phase 6: Cloud Run + IAP向けサーバー実行基盤・Dockerfile
- Phase 7: Prediction Engine統合とスマホ向け予測画面MVP、2園地比較表
- Phase 8: 各種予測を仮定値シミュレーターへ変更、定期調査分析へ前回差と収穫時予測を統合
- Phase 9: 有効状態フィルタ、園地名マスタ統合、データ管理画面（開発者用データチェック機能）、UI継続改善
- Phase 10: リポジトリ総点検（[docs/audit/REPOSITORY_AUDIT.md](docs/audit/REPOSITORY_AUDIT.md)、#102）とそのCritical/High/Medium指摘への対応（#99, #100, #101, #103–#109。詳細は「監査指摘の対応状況」を参照）
- Phase 11 (本Issue): AI Project Starter v4.5 既存プロジェクト導入モード導入（文書整備、ドキュメントと実装の乖離解消、技術的負債の記録）

## 未実装

現時点で判明している「画面骨格のみ」の機能はない（[REQUIREMENTS.md](REQUIREMENTS.md) 参照）。

## 監査指摘の対応状況

[docs/audit/REPOSITORY_AUDIT.md](docs/audit/REPOSITORY_AUDIT.md)（監査対象commit `53b306c`、2026-08-04）の指摘のうち、本Issue時点（origin/main `c58ef86`）で確認できた対応状況。

| ID | 内容 | 状況 |
|---|---|---|
| CR-1 | `optionalString`が数値/真偽値セルで例外を投げデータが消える | 対応済み（#99） |
| CR-2 | 公開リポジトリの非認証GViz読取コード・ハードコードSpreadsheet ID | 対応済み（#100、`google-sheets-analysis-data-source.ts`削除） |
| H-1 | 前回差判定が処理区の表記ゆれ・空欄を同一視しない | 対応済み（#103、`features/shared/treatment.ts`共通化） |
| H-2 | Google Sheets JWT認証ロジックが5ファイルに個別実装 | 対応済み（#104、`server/google-sheets/google-sheets-auth.ts`共通化） |
| H-3 | `periodic-analysis-client.tsx`に列定義が密結合 | 対応済み（#105、`periodic-analysis-columns.ts`分離） |
| H-4 | Prediction Masterのfetchに`cache: "no-store"`が未指定 | 対応済み（#101） |
| M-4 | 登録日時/計測日の日付正規化ロジックの重複 | 対応済み（#108） |
| M-5 | `docs/implementation-status.md`等の実装との乖離 | 対応済み（#106、本Issueでも再確認・維持） |
| M-6 | `globals.css`の非スコープCSS（最多変更ファイル） | 一部対応（#109、定期調査分析部分をCSS Modules化。他画面は未着手） |
| L-2 | npm audit High 3件、`next@16`アップグレード要 | 計画中（Issue #97。brace-expansionのみ#110で先行対応済み） |
| L-3 / L-4 | `variety-category.ts`互換レイヤ・未使用`@deprecated` export | 対応済み（#107） |
| M-1, M-2, M-3, M-7 | 年判定情報源の不一致、OCR補正の可視化、園地マスタ失敗理由の構造化、`originalOrchard`型伝播 | 未着手（Phase 2、監査レポート参照） |
| L-1 | `docs/periodic-analysis-design.md`の品種判定記述が実装に追随していない | 未確認（本Issueでは未着手） |

## 今後（Open Issueベース）

- [#22](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/22) Input正本の公開GViz依存を認証付き読取へ移行する（Output側コード（旧GViz実装・ハードコードID）は#100で削除済み。残るのはInput側Drive ACL＝リンク共有解除の確認、Owner判断が必要）
- [#72](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/72) Input側変更影響報告のフォローアップ（対応先の [#69](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/69) は実装・クローズ済み。#72自体を残すか、Ownerが判断して良い状態）
- [#97](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/97) `next@16`系へのメジャーアップグレード（npm audit High 3件対応、brace-expansionは#110で対応済み）
- 監査レポートのMedium未着手項目（M-1, M-2, M-3, M-7）と`globals.css`の残り分割（M-6）は「監査指摘の対応状況」を参照してIssue化を検討する

## 技術的負債

技術的負債の主要な棚卸しは [docs/audit/REPOSITORY_AUDIT.md](docs/audit/REPOSITORY_AUDIT.md) が担っており、重複記載を避けるため詳細はそちらを参照する。以下は同レポートでは扱われていない、本Issue（AI Project Starter導入）で新たに確認した項目。

1. **package-lock.jsonの整合性検証が早期CIステップに存在しない**: `.github/workflows/ci.yml`のlint/typecheck/test/buildステップは`npm install`を使用しており、`package.json`と`package-lock.json`の不整合があっても無言で許容・更新してしまう。一方`Dockerfile`は`npm ci`を使用しており、lockfileがpackage.jsonと厳密に一致しない場合はここで初めて失敗する。CIの早い段階でlockfile整合性を検証するステップがなく、依存追加時にlockfile更新を忘れても検知が遅れるリスクがある。現時点で実際の不整合は確認していない。
2. **Cloud Run + IAPの実運用デプロイ状況が文書間で矛盾している**（[ARCHITECTURE.md](ARCHITECTURE.md) の「ホスティング」参照）。`docs/cloud-run-hosting.md`は未デプロイの前提、`docs/audit/REPOSITORY_AUDIT.md`は稼働中（main push→即デプロイ）の前提で書かれており、どちらが正しいか本Issueの範囲では確認できなかった。
