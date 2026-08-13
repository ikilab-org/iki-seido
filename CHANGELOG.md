# 変更履歴

## [Unreleased]

### 変更

- データの流れを反転し、`data/iki-seido-org.json` を唯一の正とした。3つのビューの
  データ節と `data/*.csv` は `tools/build.mjs` の生成物になった
- URL をディレクトリ方式にした（`soshiki.html` → `soshiki/`）
- 同義語辞書71語とライフイベント8シナリオを `data/synonyms.yml` /
  `data/scenarios.yml` に分離した。条文由来ではないため出典を分けている

### 修正

- `data/datapackage.json` の `resource.path` が `data/org_units.csv` 等になっており、
  Data Resource 仕様の相対解決では `data/data/org_units.csv` を指していた。
  descriptor からの相対パスに直した
- `quality_notes` が会計課を「概要のみ」としていたが、実際は分掌事務が未収録
  （`duty_count` が 0）だった。支所・事務所と項を分けて書き直した

### 追加

- データ検査（`tools/validate.mjs`）、内部リンク検査（`tools/linkmap.mjs`）、
  例規ページの死活確認（`tools/linkcheck.mjs`）
- CI（生成漏れ検査・週次の死活確認）
- ライセンス・免責・貢献の各文書

## [0.1.0] - 2026-08-12

### 追加

- 組織系3例規の構造化（96ユニット / 597事務 / 57沿革）
- 組織図・逆引き検索・改正タイムラインの3モック
- Frictionless Data 形式のデータセット定義
