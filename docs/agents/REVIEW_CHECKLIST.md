# Independent Quality Review Checklist

実装担当とは別のエージェント(別モデルまたは少なくとも別セッション)が使う、実装後の品質レビュー用チェックリストです。
設計レビューとは分離し、実際の差分、挙動、テスト、運用上の安全性を独立して確認します。

実装担当の完了報告(「完了しました」「テスト通りました」等)は主張であり、証拠ではありません。
レビュー担当は報告をそのまま採用せず、差分とテストを自分で確認・再実行してください。
レビュー担当は指摘のみ行い、修正は実装しません。修正は実装担当へ差し戻します。

## Independent Verification

- [ ] 実装担当の完了報告を、証拠ではなく主張として扱った
- [ ] 実際の差分(diff)を自分で読んだ。要約や説明だけで済ませていない
- [ ] typecheck / lint / test / build を自分の手元またはCIログで再実行・再確認した
- [ ] 報告された検証結果と、自分で確認した結果に食い違いがないか確かめた
- [ ] このレビューで修正コードを自分では実装していない

## Requirements

- [ ] Issueと受け入れ条件が明確である
- [ ] 実装が要件を満たしている
- [ ] スコープ外の変更が混ざっていない
- [ ] `REQUIREMENTS.md` / `ARCHITECTURE.md` / ADRとの矛盾がない
- [ ] 設計レビューのblocking指摘が解消されている

## Correctness

- [ ] 正常系を確認した
- [ ] 異常系を確認した
- [ ] 境界値を確認した
- [ ] 再実行、重複、競合の影響を確認した
- [ ] エラー時に安全側へ倒れる
- [ ] 変更前後の互換性または移行方法を確認した

## Quality

- [ ] 公開インターフェースが必要以上に複雑でない
- [ ] 責務が適切に分離されている
- [ ] テストが実装詳細ではなく主要挙動を検証している
- [ ] ログに秘密情報や個人情報が出ない
- [ ] 不要な依存関係や生成物が含まれていない
- [ ] 文書またはADRの更新が必要か確認した

## Evidence

- [ ] typecheck
- [ ] lint
- [ ] test
- [ ] build
- [ ] 受け入れ条件の確認
- [ ] 手動確認または再現手順
- [ ] 失敗した検証や未実施項目が明記されている

## Findings

各指摘には優先度を付ける。

- **Critical**: 安全性、重大なデータ損失、要件不成立など。マージ不可。
- **High**: マージ前に解消すべき重大な欠陥。
- **Medium**: 解消が望ましいが、明示的に受容できるリスク。
- **Low**: 任意改善。承認を妨げない。

### Critical

- None

### High

- None

### Medium

- None

### Low

- None

## Review Result

- Decision: **Approve / Fix first / Rethink**(blocking指摘 = Critical/Highの定義は `AGENTS.md` の「レビュー独立性」を参照)
  - `Approve`: blocking指摘(Critical/High)なし。マージ可。
  - `Fix first`: blocking指摘があるが、実装方針自体は妥当。指摘を修正すれば承認できる。
  - `Rethink`: 実装方針・設計自体に疑義があり、修正では済まない。設計まで差し戻す。
- Blocking findings(Critical/High):
- Non-blocking findings:
- Accepted residual risks:
- Reviewer:
- Review session or reference:

指摘がない場合は、無理に問題を作らず `Approve` と明記する。

修正が行われた場合、このレビュー結果は無効になる。修正差分を対象に再レビューし、新しいReview Resultを記録すること(古い`Approve`を使い回さない)。
