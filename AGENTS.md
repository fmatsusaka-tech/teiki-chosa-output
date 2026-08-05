# AGENTS.md — AI Project Starter v4.5

この文書は、人間、Claude Code、Codex、その他のAIエージェントが共有するSingle Source of Truthです。

## Project Profile

- Project name: 定期調査 Output（teiki-chosa-output）
- One-line purpose: Input正本（teiki-chosa-input）が管理する調査データを読取専用で分析・比較・予測する
- Primary users: 松阪ファームの栽培管理・分析担当者（社内利用、一般公開はしない）
- Primary completion condition: 定期調査分析・園地分析・各種予測（横径/糖度/酸度）が実データで動作し、Input正本への書込みが一切発生しないこと
- Production or external effects: Google Sheets（Input正本の`調査データ`、予測原典、Output専用正規化予測マスタ）への読取。正規化予測マスタへの書込みはPrediction Master Writer経由に限定。Cloud Run + IAPでの本番運用を設計済みだが未デプロイ（詳細は[ARCHITECTURE.md](ARCHITECTURE.md)）

詳細は [VISION.md](VISION.md) / [REQUIREMENTS.md](REQUIREMENTS.md) / [ARCHITECTURE.md](ARCHITECTURE.md) / [ROADMAP.md](ROADMAP.md) を参照してください。

## 開始命令

### 新規プロジェクト（本リポジトリでは通常発生しない）

利用者が次の文言、または意味が明確に同等の指示を送った場合、通常実装より先に `docs/agents/BOOTSTRAP.md` を実行する。

```text
要件定義を読んで、開発スタート
```

本リポジトリは既にBootstrap相当の初期化（このProject Profile整備）が完了しているため、通常はこの命令は使用しない。

### 既存プロジェクトへの再導入・大規模見直し

利用者が次の文言、または意味が明確に同等の指示を送った場合、`docs/agents/ADOPT_EXISTING_PROJECT.md` を実行する。

```text
この既存プロジェクトにスターターを導入して
```

途中導入では、既存コードを要件から作り直さない。最初は読み取り専用で、実装・Git履歴・Issue・PR・テストから現状を復元する。README、ROADMAP、要件、設計と実装の乖離を必ず確認し、導入作業と機能改修を同じPRに混ぜない。

## Spreadsheet 境界

「Output は読取専用」とは、Input が管理する正本調査データに対して完全な読取専用であることを意味します。Spreadsheet の用途ごとに、次の境界を守ってください。

### Input の正本 Spreadsheet

- Input は調査データの唯一の正本です。
- Output から Input Spreadsheet へのアクセスは完全な読取専用です。
- Output が Input Spreadsheet で参照できるタブは `調査データ` だけです。他のタブは参照しません。
- Input Spreadsheet のいかなるタブ・セルにも書き込んではいけません。
- Input のコード、データ構造、見出しを変更してはいけません。
- OCR、入力、確認、登録、保存、編集キー認証は Input の責務であり、実装してはいけません。
- 派生値、予測値、AIコメントを Input へ書き戻してはいけません。

### 予測原典 Spreadsheet

- `横径予測`、`糖度予測`、`酸度予測` は予測原典 Spreadsheet 上の読取専用シートです。
- 原典シートを変更、削除、補正してはいけません。
- Prediction Master Reader は認証スコープ `https://www.googleapis.com/auth/spreadsheets.readonly` だけを使用します。
- 原典の空白セル、物理位置、係数、数式を変更せず、そのまま読み取ります。

### Output 専用の正規化予測マスタ

- `予測モデルマスタ` と `予測係数マスタ` は Output 専用の派生マスタであり、Input の正本データではありません。
- 書込みは、独立した Prediction Master Writer Issue で定義・検証された Writer だけに許可します。
- 正規化予測マスタは、検証済みの Prediction Master Reader 出力だけを生成元とします。
- Writer 以外の UI、分析処理、Prediction Engine から直接更新してはいけません。
- Writer は失敗時に既存マスタを破損させない設計とします。
- Google Sheets の書込み権限を含む権限拡大は、Writer Issue の着手時に限定して判断します。

## 基本原則

- Issueがない実装変更には着手しない
- 1 Issue = 1 branch = 1 PR
- mainへ直接コミットしない
- 同じファイルを複数エージェントが同時編集しない
- CI greenを完了の必要条件とする
- 重要判断を要件、設計、ADR、Issue、PR、HANDOFFへ保存する
- 本番操作、課金、秘密情報、外部送信、削除、不可逆操作はOwnerへ確認する

## 開発ルール

- Issue に記載された範囲だけを実装します。
- 列番号ではなく見出し名でデータを解決します。
- 数値の欠測値を `0` に変換しません。
- 変更後は `npm run typecheck`、`npm run lint`、`npm test`、`npm run build` を実行します。

連携仕様は `docs/analysis-data-interface-contract.md` を参照してください。

## 作業開始前

対象リポジトリ、remote、branch、git status、origin/mainとの差、初期化状態、対象Issue、受け入れ条件、HANDOFF、必要な検証を確認する。既存プロジェクトではREADME等の記述を正しい前提にせず、実装との乖離も確認する。

## Review Level

### Low
文書、文言、コメント、見た目、動作を変えない整理。自己確認と必要なCIで完了し、独立Reviewerは原則不要。

### Standard
通常の機能追加や小規模バグ修正。独立ReviewerがPR差分、直接関連コード、関連テスト、受け入れ条件だけを確認する。無関係なbranch比較やリポジトリ全体再監査を行わない。greenなCIを確認できる場合、全コマンドを理由なく再実行しない。

### High
DB、migration、認証、権限、秘密情報、個人情報、外部送信、削除、並行処理、idempotency、状態機械、公開API、本番反映、大規模設計変更。独立Reviewerが差分と影響経路、移行、復旧、失敗時の安全性を重点確認する。ただし総監査へ無制限に拡大しない。

Spreadsheetへの書込み経路（Prediction Master Writer）に関わる変更は原則Highとして扱う。

### レビュー独立性

- 実装担当の完了報告は証拠ではなく主張として扱う。独立Reviewerは差分・テストを自分で確認する。
- レビュー担当は指摘のみ行い、修正は実装担当へ差し戻す。修正後は旧レビュー結果を無効化し、同一差分に対して再レビューする。
- レビュー結果は `Approve` / `Fix first` / `Rethink` の三値で記録する。**blocking指摘とは Critical/High の指摘を指す**（`docs/agents/DESIGN_REVIEW_CHECKLIST.md` / `docs/agents/REVIEW_CHECKLIST.md` の重要度定義を参照）。
- やむを得ず同一担当が再レビューする場合は、その理由を記録する。

## 完了条件

- 必要なtypecheck、lint、test、build、verifyが成功
- 受け入れ条件を満たす
- Review Levelと根拠がPRにある
- Lowは自己確認、Standard/Highは独立レビュー済み
- blocking指摘が解消
- 文書とHANDOFFが更新
- PR差分が対象Issueに限定

## 作業終了

`docs/agents/HANDOFF.md`へIssue、branch、Review Level、変更ファイル、検証、レビュー、未解決事項、次の具体的な一手を残す。
