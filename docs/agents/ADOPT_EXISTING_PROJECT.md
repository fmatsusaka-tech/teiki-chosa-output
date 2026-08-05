# Existing Project Adoption

既存コードベースへAI Project Starterの運用を後付けするための手順です。

## 開始命令

利用者が次の文言、または意味が明確に同等の指示を送った場合、この手順を実行します。

```text
この既存プロジェクトにスターターを導入して
```

## 目的

既存の実装・Git履歴・設定・未完成作業を壊さず、文書、引き継ぎ、Issue/PR運用、初期化検査を導入します。新規Bootstrapのように要件から白紙設計を作り直しません。

## 原則

- 最初は読み取り専用で現状を調査する
- 未コミット変更があれば停止して確認する
- 既存コード、設定、CI、デプロイを無断で置換しない
- READMEやROADMAPの記述を実装より正しいと決めつけない
- 実装、Git履歴、Issue、PR、テスト結果から現状を復元する
- 不明な仕様は推測で確定せず、未決事項として残す
- 導入作業と機能改修を同じPRに混ぜない

## 手順

1. repository、remote、branch、git status、open Issue/PRを確認する
2. README、docs、package metadata、CI、主要コード、テストを読む
3. typecheck、lint、test、buildの現状を変更前に記録する
4. 実装済み機能、未完成機能、既知の不具合、外部接続、秘密情報の境界を整理する
5. README・ROADMAP・要件・設計と実装の乖離を記録する
6. 現在のmainへ戻れる復旧branchまたはtagを作る
7. 「Starter adoption」Issueと専用branchを作る
8. AGENTS.md、CLAUDE.md、VISION.md、REQUIREMENTS.md、ARCHITECTURE.md、ROADMAP.md、HANDOFF.mdを現状に基づいて導入・更新する
9. READMEをプロジェクト専用の入口へ更新する
10. check:starterと必要なCIを、既存の検証を壊さない形で導入する
11. 導入PRでは原則としてアプリの動作を変更しない
12. CI成功後にマージし、その後に別Issueで全体監査・改修へ進む

## 必ず確認する条件

- 未コミット変更がある
- 既存文書と実装が根本的に矛盾する
- 現在の本番構成を特定できない
- 既存CIやデプロイの置換が必要
- 秘密情報、本番データ、外部送信、課金、削除、不可逆操作が必要

## 完了条件

- 初めて読む人とAIが、目的、実装状況、検証方法、外部接続、未決事項を復元できる
- README等の文書と実装の主な乖離が解消または明記されている
- 既存の正常な動作と検証結果を維持している
- 導入後の全体監査を別Issueとして開始できる
