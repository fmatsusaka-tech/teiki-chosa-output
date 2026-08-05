# CLAUDE.md

Claude Code向けの入口です。共通規則は `AGENTS.md` を唯一の正本とします。

## 開始命令

### 新規プロジェクト（本リポジトリでは通常発生しない）

利用者が次を入力した場合は、通常実装より先に `docs/agents/BOOTSTRAP.md` のBootstrapを実行してください。

```text
要件定義を読んで、開発スタート
```

### 既存プロジェクトへの再導入・大規模見直し

利用者が次を入力した場合は `docs/agents/ADOPT_EXISTING_PROJECT.md` に従ってください。

```text
この既存プロジェクトにスターターを導入して
```

既存プロジェクトでは、最初に読み取り専用調査を行い、README・ROADMAP・要件・設計と実装の乖離を確認します。既存コードやCIを白紙化せず、スターター導入と機能改修を同じPRへ混ぜないでください。

## 起動時

1. `AGENTS.md` を読む
2. `docs/agents/HANDOFF.md` があれば読む
3. `git status`、現在branch、remote、`origin/main`との差を確認する
4. 未コミット変更があれば停止して確認する
5. 新規Bootstrap命令なら `docs/agents/BOOTSTRAP.md` に従う
6. 既存プロジェクト導入命令なら `docs/agents/ADOPT_EXISTING_PROJECT.md` に従う
7. 通常作業なら初期化状態、対象Issue、受け入れ条件を確認する
8. 曖昧さがblockingでなければ作業を進める

## Auto mode

Auto modeは定型操作の承認を省略するための機能であり、安全境界を無効にするものではありません。削除、本番反映、課金、秘密情報、外部送信、Input Spreadsheetへの書き込みは必ず停止して確認してください。

## サブエージェント

複数サブエージェントを利用する場合は、役割と書き込み権限を先に明記します。

- 調査・監査サブエージェント: 読み取り専用
- 実装サブエージェント: 1 Issue、1 worktree、1変更領域
- 統括サブエージェント: 結果統合のみ。勝手に修正しない

Bootstrapまたは既存プロジェクト導入中は、同じ初期化ファイルを複数サブエージェントへ同時編集させないでください。総監査には `docs/agents/REPOSITORY_AUDIT_GUIDE.md` を使用してください。
