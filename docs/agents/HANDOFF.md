# Agent Handoff

Claude、Codex、人間の間で共有する作業引き継ぎファイルです。
新しいIssueへ着手するときは内容を更新し、完了後も次担当者が追跡できる情報を残してください。

## Active Work

- Issue: [#111](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/111) AI Project Starter v4.5を既存プロジェクト導入モードで導入する
- Branch: `chore/adopt-ai-project-starter-v4.5`
- Primary agent: Claude(実装)
- Reviewer: 未実施（Review Level: Low、詳細は下記）
- Status: 文書導入・check:starter導入まで完了、PR作成待ち
- Last updated: 2026-08-05

## Goal and Acceptance Criteria

- Goal: AI Project Starter v4.5を既存プロジェクト導入モード（`docs/agents/ADOPT_EXISTING_PROJECT.md`）で導入し、文書と実装の乖離を解消する。アプリの挙動は変更しない。
- Acceptance criteria:
  - [x] README / VISION.md / REQUIREMENTS.md / ARCHITECTURE.md / ROADMAP.md を現状実装に合わせて整備
  - [x] AGENTS.md / CLAUDE.md / docs/agents/HANDOFF.md を導入（既存のSpreadsheet境界・開発ルールを維持）
  - [x] ドキュメントと実装の乖離を整理（`docs/implementation-status.md`の「各種予測は未実装」等の記述を修正）
  - [x] 実装済み・未実装・対象外機能を整理（REQUIREMENTS.md / ROADMAP.md / docs/implementation-status.md）
  - [x] package-lock.json問題など技術的負債を記録（ROADMAP.mdの「技術的負債」）
  - [x] Issueを整理（#22, #72, #97との関係をROADMAP.mdに記録）
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

## Work Completed

- リポジトリ、remote（`origin`のみ、`legacy`remoteは別作業で削除済み）、branch、git statusを確認
- 導入前のベースライン検証を記録: `typecheck` green、`lint` green、`test` 432件green、`build` green、`npm audit` High 4件（Issue #97で追跡中）
- `src/app`, `src/features`, `src/server`を調査し、実装済み/未実装機能を復元（各種予測はPrediction Engine統合済みで実装済み、データ管理画面のみ骨格）
- 復旧用tag `pre-starter-adoption-v4.5` を導入前の`origin/main`(f710aa7)へ作成・push
- Issue #111、branch `chore/adopt-ai-project-starter-v4.5` を作成
- README / VISION.md / REQUIREMENTS.md / ARCHITECTURE.md / ROADMAP.md / docs/implementation-status.md を現状実装に基づき新規作成・更新
- AGENTS.md（既存のSpreadsheet境界・開発ルールを維持しつつv4.5のProject Profile・Review Level・レビュー独立性ルールを統合）、CLAUDE.md、`docs/agents/`配下を導入
- `scripts/check-project-initialized.mjs`（既存プロジェクト導入向けに`docs/input`必須チェックを除外して適応）とテストを追加、`package.json`に`check:starter`を追加、CIへ非破壊的に追加

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
| `npm run typecheck`(導入前ベースライン) | Green | |
| `npm run lint`(導入前ベースライン) | Green | |
| `npm test`(導入前ベースライン) | Green | 31 files / 432 tests |
| `npm run build`(導入前ベースライン) | Green | |
| `npm audit`(導入前ベースライン) | High 4件 | Issue #97で追跡中、`next@16`系アップグレードが必要 |
| `npm run check:starter`(導入後) | (PR作成時に記録) | |
| `npm run typecheck` / `lint` / `test` / `build`(導入後) | (PR作成時に記録) | 文書・script追加のみでアプリコード無変更のため、導入前と同じgreenを期待 |
| CI (`ci.yml`) | (PR作成後に記録) | |

## Decisions Made

- Decision: root直下に作っていた`HANDOFF.md`（legacy remote削除作業の記録）は削除し、内容を`docs/agents/HANDOFF.md`とREADME.mdの「リポジトリ」節に統合した。
- Reason: v4.5導入により`docs/agents/HANDOFF.md`が正本のHANDOFF配置になるため、root直下に別のHANDOFFファイルを残すと二重管理になる。
- Decision: `scripts/check-project-initialized.mjs`から、starter付属の`docs/input`必須チェック（要件原文の保全確認）を除外した。
- Reason: 本リポジトリはBootstrapではなく既存プロジェクト導入モードで初期化しており、`docs/input/`に保全すべき要件原文が存在しない。`docs/agents/ADOPT_EXISTING_PROJECT.md`の完了条件にも`docs/input`は含まれていない。
- Decision: `docs/agents/REPOSITORY_AUDIT_GUIDE.md`をv4.4の内容のまま導入した。
- Reason: 配布されたv4.5パッケージには本ファイルが含まれていなかったが、v4.5のCLAUDE.md/AGENTS.mdの記述から本ファイルへの参照が存在し、内容自体はバージョン間で変更されていないため。
- Related ADR: なし（運用文書の追加であり、アプリケーションのアーキテクチャ変更を伴わないためADR対象外と判断）

## Open Questions and Risks

- Issue #22（Input正本の公開GViz依存を認証付き読取へ移行する）は、定期調査分析・園地分析についてはコード上は認証付き経路へ移行済みに見えるが、Issueが依然Openであり、ACL変更（リンク共有の解除）など運用面の完了条件が残っている可能性がある。本Issueでは判断せず、ROADMAP.mdに現状を記録するのみとした。
- Issue #72（Input側変更影響報告）は、対応先の#69が実装・クローズ済みのため、#72自体をクローズしてよいかはOwnerの判断に委ねた（本Issueではクローズしていない）。
- `src/repositories/*`（旧GViz経路）と`src/server/*`（認証付き経路）の並存が、#22完了後に旧経路を削除できる状態かどうかは未確認。

## Exact Next Step

1. 本Issue用のPRを作成し、`npm run check:starter`を含む全検証を実行してCI greenを確認する。
2. Ownerへマージ可否を確認し、承認後にマージする。
3. マージ後、別Issueで`docs/agents/REPOSITORY_AUDIT_GUIDE.md`に基づく全体監査を開始する。

## Read First

- `AGENTS.md`
- `docs/agents/ADOPT_EXISTING_PROJECT.md`
- `ROADMAP.md`（技術的負債・Issue整理）
