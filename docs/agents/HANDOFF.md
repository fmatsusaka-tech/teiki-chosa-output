# Agent Handoff

Claude、Codex、人間の間で共有する作業引き継ぎファイルです。

## Active Work

- Issue: [#115](https://github.com/fmatsusaka-tech/teiki-chosa-output/issues/115) データ管理画面を読取専用の検索・採用状態確認へ拡張する
- Branch: `codex/data-management-inventory-115`
- Primary agent: Codex
- Review Level: Standard（認証・Spreadsheetアクセス境界を変えない読取専用UIと純粋集計の追加）
- Status: 実装・ローカル検証・Draft PR #116・CI完了。独立レビュー待ち
- Last updated: 2026-08-11

## Goal and Acceptance Criteria

- 全レコード、有効、無効、標準分析対象、状態対象外の件数を表示する。
- 登録ID、園地、品種、処理区、計測日を検索できる。
- 採用状態とデータ状態で絞り込める。
- 50件単位で表示し、スマートフォンでページ全体を横崩れさせない。
- `無効`だけを除外し、空欄と`有効`を採用する既存契約を再利用する。
- Input正本はGETのみ。Writer資格情報、Spreadsheet書込み、Input変更を追加しない。
- typecheck、lint、全テスト、build、CIを成功させる。

## Files Changed

- `src/features/data-diagnostics/analysis-data-inventory.ts`
- `src/features/data-diagnostics/analysis-data-inventory.test.ts`
- `src/server/analysis-data/data-management-page-data.ts`
- `src/server/analysis-data/data-management-page-data.test.ts`
- `src/app/data-management/page.tsx`
- `src/app/data-management/data-management-client.tsx`
- `src/app/globals.css`
- `REQUIREMENTS.md`
- `docs/implementation-status.md`
- `docs/agents/HANDOFF.md`

## Decisions

- データの編集・有効無効変更はInputの責務なので、Outputのデータ管理画面は読取専用とする。
- 一覧には入力者、備考、個別調査値を出さず、採用判断に必要な最小項目だけを表示する。
- 状態判定は既存の`isEnabledAnalysisRecord()`と`isIncludedInAnalysis()`を再利用し、別契約を作らない。

## Verification Evidence

- `npm run typecheck`: Green
- `npm run lint`: Green
- `npm test`: Green（39ファイル、491テスト）
- `npm run build`: Green
- `git diff --check`: Green
- CI `verify`: Green（Draft PR #116）

## Exact Next Step

1. 独立レビューを行い、blocking指摘を解消する。
2. Approve後にReady化・Squash mergeする。
