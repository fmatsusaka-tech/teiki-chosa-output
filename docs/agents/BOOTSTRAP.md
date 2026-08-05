# Project Bootstrap Guide v4.4

## 目的

利用者が次の一言だけで、要件定義からプロジェクト初期化と開発開始まで進められるようにする。

```text
要件定義を読んで、開発スタート
```

この文書はBootstrapの実行手順の正本です。`AGENTS.md`の安全境界と開発ルールを常に優先します。

本リポジトリは既存プロジェクト導入モード（[ADOPT_EXISTING_PROJECT.md](ADOPT_EXISTING_PROJECT.md)）で初期化済みのため、通常はこのBootstrapを実行しません。将来、別プロジェクトのひな形として使う場合や、白紙状態からの再初期化が必要な場合に参照してください。

## 完了状態

Bootstrap完了とは、次をすべて満たす状態です。

- 要件定義の原文が `docs/input/` に変更されず保全されている
- README、VISION、REQUIREMENTS、ARCHITECTURE、ROADMAPがプロジェクト固有になっている
- AGENTSのProject Profile、package.json、HANDOFFが初期化されている
- `STARTER_PLACEHOLDER`が残っていない
- `npm run check:starter`が成功する
- 必要なtypecheck、lint、test、buildが成功する
- Bootstrap IssueとPRが存在し、CI greenである
- 初期化PRがマージ済み、またはマージできない理由が明記されている
- 要件から開発Issueが作成され、依存関係と優先順位が整理されている

## Phase 0: 安全確認

最初に、リポジトリのルート、remote、現在branch、`git status`、`origin/main`との差、既存Issue・PR、`docs/input/`、初期化状態を確認する。

未コミット変更がある場合は、勝手に破棄、stash、commit、上書きしない。Bootstrapと安全に分離できなければOwnerへ確認する。

## Phase 1: 要件原文の確定

- `docs/input/`内を探索する。`docs/input/README.md`は要件原文に数えない。
- 要件ファイルを変更せず読み、複数ファイルが補完関係なら統合する。
- 要件がチャット本文だけの場合、原文を省略・修正せず `docs/input/ORIGINAL_REQUIREMENTS.md` に保存する。
- 要件が見つからない場合は機能実装を始めず、要件定義の配置を依頼する。

## Phase 2: 要件抽出

プロジェクト名、目的、対象利用者、主要ユースケース、機能・非機能要件、データ、外部連携、制約、非対象、完成条件、未決事項を抽出する。推測は確定事項と混ぜない。

## Phase 3: Bootstrap Issueとbranch

GitHub操作が可能ならBootstrap Issueを作り、`chore/bootstrap-project` branchを使う。Issueには要件原文、初期化対象、受け入れ条件、変更しない範囲、未決事項、Review Levelを含める。

## Phase 4: 文書と設定の初期化

- `README.md`: 目的、利用フロー、実装状況、構成、技術、環境変数名、セットアップ、検証、デプロイ状況、既知制約
- `VISION.md`: 目的、利用者、価値、成功条件、非対象
- `REQUIREMENTS.md`: ユースケース、機能・非機能要件、データ、外部連携、未決事項
- `ARCHITECTURE.md`: 最小構成、責務、データフロー、データモデル、API、セキュリティ、障害時設計
- `ROADMAP.md`: 依存関係に沿った実装Phase
- `package.json`: name、description、version、scripts、依存関係
- `AGENTS.md`: Project Profile
- `docs/agents/HANDOFF.md`: Bootstrap状況、検証、未決事項、次のIssue

## Phase 5: 初期化マーカー除去

各ファイルをプロジェクト固有内容へ更新した後でのみ `STARTER_PLACEHOLDER` を除去する。マーカーだけ削除して未記入内容を残さない。

## Phase 6: 検証

原則として次を実行する。

```bash
npm install
npm run check:starter
npm run typecheck
npm run lint
npm test
npm run build
```

異なる構成なら同等の検証へ置き換え、理由をIssueとPRへ記録する。

## Phase 7: PRとマージ

PRへ要件原文の場所、更新文書、検証、未決事項、次の開発Issueを記載する。CI greenでblocking指摘がなく、安全境界に触れない場合はマージしてよい。本番操作、課金、秘密情報、外部送信、削除、不可逆操作は停止して確認する。

## Phase 8: 開発Issue作成と開始

要件を実装可能なIssueへ分割し、背景、目的、受け入れ条件、対象外、依存Issue、検証方法、Review Levelを記載する。Bootstrap PR完了後、依存元と最重要ユースケースから開発を開始する。
