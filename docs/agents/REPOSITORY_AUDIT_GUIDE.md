# Repository Audit Guide

## 監査とレビューの違い

PRレビューは限定された差分を評価する。リポジトリ監査は、履歴、構造、重複、仕様混在、未検証領域を横断して評価する。

## 監査前チェック

- remote URLは正しいか
- 最新の`origin/main`か
- cloneが複数存在しないか
- 未コミット変更がないか
- 開発中cloneを壊さないか
- 依存導入とverifyが実行可能か

不適切な場合は最新`origin/main`から監査専用cloneを作る。

## 監査実行

1. 依存導入
2. lint / typecheck / test / build / verify
3. Git履歴と主要変更領域の把握
4. Auditor A、Bを読み取り専用で並行実行
5. Integratorが根拠を再確認
6. `docs/audit/REPOSITORY_AUDIT.md`作成
7. 停止して人間へ報告

## 指摘の最低要件

- ID
- 重要度
- 対象ファイル・行または関数
- 症状
- 再現条件
- 根拠
- 推奨修正
- 追加テスト
- 確信度: Confirmed / Likely / Hypothesis

## 重要度

- Critical: データ破壊、重大漏えい、主要機能停止、即時対応
- High: 現実的条件で誤動作、重要データ不整合、重大な保守リスク
- Medium: 限定条件の不具合、将来の高い変更コスト
- Low: 可読性、軽微な不統一、改善候補

## 成果物テンプレート

`docs/audit/REPOSITORY_AUDIT.md`へ次を記載する。

1. 結論
2. 対象commitと監査環境
3. 実行した検証
4. Critical / High
5. Medium / Low
6. 設計上のつぎはぎ
7. 不足テスト
8. セキュリティ・運用懸念
9. Phase 0: 緊急修正
10. Phase 1: 安全な整理
11. Phase 2: 構造改善
12. 今は触らない箇所
13. Issue化候補
14. 監査の限界
