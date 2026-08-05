# ROADMAP.md

実装済みIssue履歴（Git log）から復元した実装フェーズです。今後のフェーズは既存Open Issueと技術的負債に基づきます。

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
- Phase 9: 有効状態フィルタ、園地名マスタ統合、UI改善（横スクロール同期・列順・配色等の継続的改善、直近まで継続中）
- Phase 10 (本Issue): AI Project Starter v4.5 既存プロジェクト導入モード導入（文書整備、ドキュメントと実装の乖離解消、技術的負債の記録）

## 未実装

- データ管理画面（`/data-management`）: 検索・確認機能。要件未定義。

## 今後（Open Issueベース）

- [#22](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/22) Input正本の公開GViz依存を認証付き読取へ移行する（定期調査分析・園地分析は移行済み、残る経路の洗い出しとACL変更が必要）
- [#97](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/97) `next@16`系へのメジャーアップグレード（npm audit High 4件対応）
- [#72](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/72) Input側変更影響報告のフォローアップ（対応先の [#69](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/69) は実装・クローズ済み。#72自体を残すか、Ownerが判断して良い状態）
- 導入後の全体監査（別Issueで [docs/agents/REPOSITORY_AUDIT_GUIDE.md](docs/agents/REPOSITORY_AUDIT_GUIDE.md) に基づき実施）

## 技術的負債

1. **npm audit High 4件**（`brace-expansion`, `postcss`, `sharp`, `next`が依存として牽引）。修正には`next@16`系への破壊的変更を伴うアップグレードが必要。[#97](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/97) で計画中、緊急対応は不要と判断済み（`next.config.ts`の`images.unoptimized: true`によりsharp経由の画像処理は実際には使用されていない可能性が高い）。
2. **package-lock.jsonの整合性検証が早期CIステップに存在しない**: `.github/workflows/ci.yml`のlint/typecheck/test/buildステップは`npm install`を使用しており、`package.json`と`package-lock.json`の不整合があっても無言で許容・更新してしまう。一方`Dockerfile`は`npm ci`を使用しており、lockfileがpackage.jsonと厳密に一致しない場合はここで初めて失敗する。CIの早い段階でlockfile整合性を検証するステップがなく、依存追加時にlockfile更新を忘れても検知が遅れるリスクがある。現時点で実際の不整合は確認していない（`npm ls`・`npm ci`相当の整合は確認済み）。
3. **`docs/implementation-status.md`が実装から乖離していた**（本Issueで更新）: 「各種予測は画面骨格のみ」「Prediction Engine未実装」という2026-07-27時点の記述が、その後のPrediction Engine統合・仮定値シミュレーター実装後も更新されていなかった。
4. **`src/repositories/*`（GViz経路）と`src/server/*`（認証付き経路）が並存**: 定期調査分析・園地分析は認証付き経路へ移行済みだが、旧GViz経路の実装がリポジトリに残っている。[#22](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/22) の完了後に旧経路を削除できるか要確認。
5. **`docs/audit/REPOSITORY_AUDIT.md`が存在しない**: [#97](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/97) は過去のリポジトリ総点検の指摘を根拠にしているが、その監査成果物自体はリポジトリに残っていない。今後の全体監査では成果物を`docs/audit/REPOSITORY_AUDIT.md`として保存することを推奨する。
