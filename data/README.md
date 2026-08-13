# 壱岐市 行政組織データセット(例規由来) v0.1.0

壱岐市の3つの組織例規 ─ 行政組織条例・行政組織規則・教育委員会事務局組織規則 ─ の条文から起こした、機械可読の組織データセットです。IKILAB の「規定集の見える化」プロジェクトの土台(アイデアD)にあたり、組織図(A)・逆引き検索(B)・改正タイムライン(C)の3つのモックはすべてこのデータから描画できます。

## 収録内容

| ファイル | 内容 | 件数 |
|---|---|---|
| `data/iki-seido-org.json` | 全データ(組織+分掌事務+改正沿革+メタ情報) | ─ |
| `data/org_units.csv` | 組織ユニット(部・課・班・室・出先機関)の一覧 | 96件 |
| `data/duties.csv` | 分掌事務(条文の号単位) | 597件 |
| `data/amendments.csv` | 改正沿革(制定含む) | 57件 |
| `datapackage.json` | Frictionless Data 形式のデータセット定義 | ─ |
| `scripts/build_dataset.js` | 今回実際に使った生成スクリプト | ─ |
| `scripts/parse_reiki.py` | 本番用パイプラインの骨格(例規HTML→同スキーマ) | ─ |

組織ユニットの内訳: 部6 / 課24 / 班59 / 室1 / 出先機関6(支所4・福祉事務所・事務所グループ)。

## スキーマ概要

**org_units.csv** ─ `id`(u001〜), `name`, `level`(部/課/班/室/出先機関), `parent_id`(階層はこの親参照で辿る), `branch`(市長部局本庁/会計/出先/教委の別), `legal_source`(jorei/kisoku/kyoiku), `article`(根拠条文), `duty_count`, `note`

**duties.csv** ─ `id`(d0001〜), `unit_id`, `unit_name`, `seq`(号の順序), `text`(条文の文言), `legal_source`, `article`

**amendments.csv** ─ `source`, `promulgated_on`(公布日・条例のみ), `enforced_on`(施行日・条例のみ), `recorded_on`(沿革記載日・規則/教委規則), `number`(例規番号), `kind`(制定/改正/附則未掲載)

## 出典と取得方法

- [壱岐市行政組織条例](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000958.html)(平成23年条例第1号・令和7年6月1日施行)
- [壱岐市行政組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html)(平成16年規則第2号・令和7年6月1日施行)
- [壱岐市教育委員会事務局組織規則](https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000190.html)(平成16年教委規則第5号・平成31年4月1日施行)

2026年8月11日に例規ページを取得し、条文構造(部→課→班、各号の分掌事務、沿革)を抽出・構造化した。v0.1はLLM支援の半手動抽出。品質上の注意は下記。

## 品質上の注意(v0.1の既知の限界)

- 支所・事務所・会計課の分掌事務は概要のみ(原文は支所だけで約69号を列挙)。
- 教育委員会規則の分掌事務の条番号は未確定(第2条=内部組織のみ確認済み)。
- 沿革の `recorded_on` は例規ページの沿革表記に基づき、公布日と施行日が混在している可能性がある。
- 令和8年3月19日条例第4号は沿革に記載があるが、本文ページに附則が見当たらず内容未確認(ウォッチ対象)。

## ライセンスについて

条例・規則の本文は著作権法第13条により権利の目的とならないため、条文由来の部分の二次利用は法的に自由。データセットとしての整理・構造化部分は **CC BY 4.0**、コード(スクリプト類)は **MIT** ─ 同じIKILABの [iki-keikaku(壱岐市 計画マップ)](https://github.com/ikilab-org/iki-keikaku) のライセンス方針を踏襲する。CC0は「解釈や推定を含む資料は出所が辿れなくなる」という同プロジェクトの検討理由により不採用。クレジット記載例などもiki-keikakuの about/license/ に倣う。

## 更新方針(構想)

iki-watch で例規ページを監視 → 改正検知時に `scripts/parse_reiki.py` で再生成 → バージョンを上げて差分(新旧対照)とともに公開、というパイプラインを想定。改正のたびに `amendments` が伸び、`organization`/`duties` のスナップショットが版として積み重なる。

---
ikilab.org / 2026-08
