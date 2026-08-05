# Agent Handoff

Claude、Codex、人間の間で共有する作業引き継ぎファイルです。
新しいIssueへ着手するときは内容を更新し、完了後も次担当者が追跡できる情報を残してください。

## Active Work

- Issue: [#111](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/111) AI Project Starter v4.5を既存プロジェクト導入モードで導入する
- Branch: `chore/adopt-ai-project-starter-v4.5`
- Primary agent: Claude(実装)
- Reviewer: 未実施（Review Level: Low、詳細は下記）
- Status: origin/mainを取り込み・文書内容を最新化済み。PR作成・CI確認待ち
- Last updated: 2026-08-05

## Goal and Acceptance Criteria

- Goal: AI Project Starter v4.5を既存プロジェクト導入モード（`docs/agents/ADOPT_EXISTING_PROJECT.md`）で導入し、文書と実装の乖離を解消する。アプリの挙動は変更しない。
- Acceptance criteria:
  - [x] README / VISION.md / REQUIREMENTS.md / ARCHITECTURE.md / ROADMAP.md を現状実装に合わせて整備
  - [x] AGENTS.md / CLAUDE.md / docs/agents/HANDOFF.md を導入（既存のSpreadsheet境界・開発ルールを維持）
  - [x] ドキュメントと実装の乖離を整理
  - [x] 実装済み・未実装・対象外機能を整理（REQUIREMENTS.md / ROADMAP.md / docs/implementation-status.md）
  - [x] package-lock.json問題など技術的負債を記録（ROADMAP.mdの「技術的負債」）
  - [x] Issueを整理（#22, #72, #97との関係、および既存の全体監査レポートとの関係をROADMAP.mdに記録）
  - [x] check:starterと最小限のCIステップを既存の検証を壊さない形で導入
  - [ ] PR作成、CI green確認、Ownerによるマージ可否判断

## Scope

### Change

- ルート文書: `README.md`, `VISION.md`, `REQUIREMENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `AGENTS.md`, `CLAUDE.md`
- `docs/implementation-status.md`（内容更新）
- `docs/agents/`配下の新規導入（`ADOPT_EXISTING_PROJECT.md`, `BOOTSTRAP.md`, `COLLABORATION.md`, `DESIGN_REVIEW_CHECKLIST.md`, `REVIEW_CHECKLIST.md`, `REPOSITORY_AUDIT_GUIDE.md`, `HANDOFF.md`）
- `scripts/check-project-initialized.mjs` と対応するテスト、`package.json`の`check:starter`スクリプト
- `.github/workflows/ci.yml`（`check:starter`ステップの追加のみ）

### Do not change

- `src/`配下のアプリケーションコード、既存の`typecheck` / `lint` / `test` / `build`の内容（本Issueはアプリの挙動を変更しない）
- 既存の3件のOpen Issue（#22, #72, #97）自体のクローズ・内容変更（整理・参照のみ行い、判断はOwnerに委ねる）
- `docs/audit/REPOSITORY_AUDIT.md`の内容（既存の全体監査レポート。参照のみ）

## Work Completed

- リポジトリ、remote（`origin`のみ、`legacy`remoteは別作業で削除済み）、branch、git statusを確認
- 導入前のベースライン検証を記録: `typecheck` green、`lint` green、`test` 432件green、`build` green、`npm audit` High 4件
- `src/app`, `src/features`, `src/server`を調査し、実装済み/未実装機能を復元
- 復旧用tag `pre-starter-adoption-v4.5` を導入前の`origin/main`(f710aa7)へ作成・push
- Issue #111、branch `chore/adopt-ai-project-starter-v4.5` を作成
- README / VISION.md / REQUIREMENTS.md / ARCHITECTURE.md / ROADMAP.md / docs/implementation-status.md を新規作成・更新
- AGENTS.md（既存のSpreadsheet境界・開発ルールを維持しつつv4.5のProject Profile・Review Level・レビュー独立性ルールを統合）、CLAUDE.md、`docs/agents/`配下を導入
- `scripts/check-project-initialized.mjs`（既存プロジェクト導入向けに`docs/input`必須チェックを除外して適応）とテストを追加、`package.json`に`check:starter`を追加、CIへ非破壊的に追加
- **作業途中でorigin/mainが33コミット先行していることを検知**（他セッションによる並行作業）。`git merge origin/main`で取り込み、`docs/implementation-status.md`の1件の競合を解決。取り込んだ変更には、既存の全体監査レポート追加（#102, `docs/audit/REPOSITORY_AUDIT.md`）とその指摘への対応（#99–#110）が含まれていたため、本Issueの文書（ROADMAP.md / REQUIREMENTS.md / ARCHITECTURE.md / README.md）を再調査し、以下を反映して更新した。
  - データ管理画面は実装済み（骨格のみという当初の記載は誤りだった）
  - 旧GViz読取実装は削除済み（`src/repositories/google-sheets-analysis-data-source.ts`は存在しない）
  - `docs/audit/REPOSITORY_AUDIT.md`が既に存在するため、技術的負債の記載を重複させず同レポートを参照する形に整理
  - npm audit Highは4件→3件（brace-expansionは#110で対応済み）
  - **Cloud Run + IAPの実運用デプロイ状況が`docs/cloud-run-hosting.md`（未デプロイの前提）と`docs/audit/REPOSITORY_AUDIT.md`（稼働中・main push即デプロイの前提）で矛盾していることを発見**。本Issueの範囲では実際の状態を確認できず、未決事項として記録した
- マージ後、`npm install` / `typecheck` / `lint` / `test` / `build` / `check:starter`を再実行しすべてgreenを確認

## Files Changed

- `README.md`, `VISION.md`, `REQUIREMENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`
- `AGENTS.md`, `CLAUDE.md`
- `docs/implementation-status.md`
- `docs/agents/ADOPT_EXISTING_PROJECT.md`, `docs/agents/BOOTSTRAP.md`, `docs/agents/COLLABORATION.md`, `docs/agents/DESIGN_REVIEW_CHECKLIST.md`, `docs/agents/REVIEW_CHECKLIST.md`, `docs/agents/REPOSITORY_AUDIT_GUIDE.md`, `docs/agents/HANDOFF.md`
- `scripts/check-project-initialized.mjs`, `scripts/check-project-initialized.test.mjs`
- `package.json`（`check:starter`スクリプト追加）
- `.github/workflows/ci.yml`（`check:starter`ステップ追加）

## Verification Evidence

| Command / check | Result | Notes |
|---|---|---|
| `npm run typecheck`(導入前ベースライン、f710aa7) | Green | |
| `npm run lint`(導入前ベースライン) | Green | |
| `npm test`(導入前ベースライン) | Green | 31 files / 432 tests |
| `npm run build`(導入前ベースライン) | Green | |
| `npm audit`(導入前ベースライン) | High 4件 | |
| `npm run check:starter`(origin/mainマージ後) | Green | |
| `npm run typecheck`(origin/mainマージ後) | Green | |
| `npm run lint`(origin/mainマージ後) | Green | |
| `npm test`(origin/mainマージ後) | Green | 36 files / 469 tests |
| `npm run build`(origin/mainマージ後) | Green | |
| `npm audit`(origin/mainマージ後) | High 3件 | Issue #97で追跡中、`next@16`系アップグレードが必要 |
| CI (`ci.yml`) | (PR作成後に記録) | |

## Decisions Made

- Decision: root直下に作っていた`HANDOFF.md`（legacy remote削除作業の記録）は削除し、内容を`docs/agents/HANDOFF.md`とREADME.mdの「リポジトリ」節に統合した。
- Reason: v4.5導入により`docs/agents/HANDOFF.md`が正本のHANDOFF配置になるため、root直下に別のHANDOFFファイルを残すと二重管理になる。
- Decision: `scripts/check-project-initialized.mjs`から、starter付属の`docs/input`必須チェック（要件原文の保全確認）を除外した。
- Reason: 本リポジトリはBootstrapではなく既存プロジェクト導入モードで初期化しており、`docs/input/`に保全すべき要件原文が存在しない。
- Decision: `docs/agents/REPOSITORY_AUDIT_GUIDE.md`をv4.4の内容のまま導入した。
- Reason: 配布されたv4.5パッケージには本ファイルが含まれていなかったが、v4.5のCLAUDE.md/AGENTS.mdの記述から本ファイルへの参照が存在し、内容自体はバージョン間で変更されていないため。
- Decision: 本Issueの「技術的負債」記載は、既存の`docs/audit/REPOSITORY_AUDIT.md`と重複させず、同レポートで扱われていない項目（package-lock.json整合性検証の欠如、Cloud Runデプロイ状況の矛盾）のみを追記する形にした。
- Reason: origin/mainマージ時に、2026-08-04付けで既に詳細な全体監査が実施済みであることが判明したため。本Issueで独自に劣化コピーを作ると二重管理・将来の乖離リスクになる。
- Related ADR: なし（運用文書の追加であり、アプリケーションのアーキテクチャ変更を伴わないためADR対象外と判断）

## Open Questions and Risks

- **Cloud Run + IAPの実運用デプロイ状況が未確認**（`docs/cloud-run-hosting.md`と`docs/audit/REPOSITORY_AUDIT.md`の記述が矛盾）。次にこのリポジトリを触るエージェントは、mainへの変更が本番へ即時反映される可能性を前提に慎重に扱うこと。Ownerに実際の状態を確認してもらうことを推奨。
- Issue #22（Input正本の公開GViz依存を認証付き読取へ移行する）は、Output側コード（旧GViz実装・ハードコードID）は#100で削除済みだが、Input側Drive ACL（リンク共有の解除）の確認が残っている可能性があり、Issueは依然Open。
- Issue #72（Input側変更影響報告）は、対応先の#69が実装・クローズ済みのため、#72自体をクローズしてよいかはOwnerの判断に委ねた（本Issueではクローズしていない）。
- `docs/audit/REPOSITORY_AUDIT.md`のMedium項目（M-1, M-2, M-3, M-7）と`globals.css`の残り分割（M-6の一部）は未着手のまま。Issue化は本Issueの範囲外とした。

## Exact Next Step

1. 本Issue用のPRを作成し、`npm run check:starter`を含む全検証を実行してCI greenを確認する。
2. Ownerへマージ可否を確認し、特にCloud Runデプロイ状況の矛盾について実際の状態を確認してもらう。
3. 承認後にマージする。全体監査は既に`docs/audit/REPOSITORY_AUDIT.md`として実施済みのため、次はその未着手項目（Medium群、`next@16`アップグレード）のIssue化・対応を検討する。

## Read First

- `AGENTS.md`
- `docs/agents/ADOPT_EXISTING_PROJECT.md`
- `docs/audit/REPOSITORY_AUDIT.md`（既存の全体監査レポート、未着手項目あり）
- `ROADMAP.md`（技術的負債・Issue整理）
