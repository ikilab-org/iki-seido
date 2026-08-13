# iki-seido リポジトリ整備 設計

2026-08-13 / IKILAB

## 1. 背景

iki-seido は 2026年8月のブレストで v0.1 の試作までできている。組織系3例規から
起こしたデータセット（96ユニット / 597事務 / 57沿革）と、そこから描いた3つの
ビュー（A 組織図・B 逆引き検索・C 改正タイムライン）がある。

一方でバージョン管理下になく、ROADMAP v0.2 の「GitHubリポジトリ公開」と
v0.3 の「静的サイト公開」が未着手のまま残っている。本設計はこの2項目を
まとめて片づけ、`seido.ikilab.org` として公開できる状態にすることを扱う。

整備の過程で、公開前に直すべき構造上の問題が2つ見つかった。

**問題1: データの流れが設計原則と逆を向いている。** ROADMAP の設計原則(1)は
「単一のデータ源 ─ すべてのビューは同じデータセットから描く」だが、実態は
条文データが3本のモックHTMLに直接埋め込まれ（`soshiki.html:194` の `BRANCHES`
以下など）、`scripts/build_dataset.js` がそのHTMLを読んで `data/` を生成して
いる。同じ597件が HTML3本 + `data/` の4箇所に重複しており、1件の訂正に
4箇所の編集が要る。さらに `data/` 内でも JSON と3本の CSV が独立した実体で、
重複はもう一段ある。

**問題2: 条文由来でないデータが混在している。** 同義語辞書71語
（`madoguchi.html:316` の `SYN`）とライフイベント8シナリオ（同 `:343` の
`SCENARIOS`）は IKILAB が書いたもので、著作権法13条が及ばない条文とは
権利関係が異なる。出典を分けて示す必要がある（ROADMAP v0.3「例規に無い情報は
出典を分けて明示」）。

## 2. スコープ

**やること**

- iki-keikaku（`ikilab-org/iki-keikaku`）の規約ファイル一式を iki-seido 用に整備
- データの流れを `data/` → ビューに反転させ、ビューを生成物にする
- 条文由来でないデータを `data/` の別ファイルに分離
- データ検査（validate）と CI（生成漏れ検査・内部リンク検査・linkcheck）の整備
- URL をディレクトリ方式に変更し、双方向の内部リンクを修正（§3.1）
- `ikilab-org/iki-seido` の作成と GitHub Pages 公開（`seido.ikilab.org`）

**やらないこと**

- `parse_reiki.py` の本実装（ROADMAP v0.2 の別項目）
- 欠損データの収録（支所の窓口業務約69号など。同上）
- 令和8年3月19日条例第4号の内容確認（同上）
- ビューの描画ロジック・CSS・レイアウトの変更（§4.1 の生成範囲を除く）
- HTML の完全テンプレート化（§4.6 の却下案1を参照）

## 3. リポジトリ構成

```
iki-seido/
├ index.html                    ポータル（手書き・生成対象外）
├ soshiki/index.html            A 組織図        ┐
├ madoguchi/index.html          B 逆引き検索     ├ データ節のみ生成
├ ugoki/index.html              C 改正タイムライン ┘
├ about/license/index.html      ライセンス解説
├ data/
│  ├ iki-seido-org.json         条文由来データ（唯一の正）
│  ├ org_units.csv              ┐
│  ├ duties.csv                 ├ JSON からの派生物（生成）
│  ├ amendments.csv             ┘
│  ├ datapackage.json           Frictionless Data 定義（手書き）
│  ├ synonyms.yml               同義語辞書71語（IKILAB著作）
│  ├ scenarios.yml              ライフイベント8シナリオ（同上）
│  └ README.md
├ tools/                        外部依存なし・各 *.test.mjs 付き
│  ├ build.mjs                  data/ → 各HTMLのデータ節・CSV を生成
│  ├ view-model.mjs             フラットな org_units → ビュー用の木構造
│  ├ validate.mjs               データ検査
│  ├ search.mjs                 同義語の展開（HTML へも生成される実体）
│  ├ linkcheck.mjs              例規ページの死活確認
│  ├ linkmap.mjs                内部リンクの解決検査
│  ├ yaml.mjs                   YAML読み取り（iki-keikaku から流用）
│  └ __fixtures__/
│     ├ v0.1-data.json          変換テストの入力（凍結）
│     └ v0.1-views.json         変換テストの期待値（凍結）
├ scripts/
│  ├ build_dataset.js           v0.1 の生成経路（役割終了を冒頭に明記して保存）
│  └ parse_reiki.py             v0.2 で本実装
├ .github/
│  ├ workflows/build.yml, linkcheck.yml
│  └ ISSUE_TEMPLATE/correction.md, not-found.md
├ docs/superpowers/specs/       設計文書
├ LICENSE                       CC BY 4.0 法文
├ LICENSE-CODE                  MIT
├ NOTICE.md / DISCLAIMER.md / CONTRIBUTING.md / CHANGELOG.md / README.md
├ SETUP.md / ROADMAP.md
└ CNAME / .nojekyll / .gitignore
```

### 3.1 URL 設計

ディレクトリ方式を採り、iki-keikaku と揃える。`.html` を露出させず、将来
ページが増えたときの分割にも耐える。

| 現在 | 変更後 |
|---|---|
| `soshiki.html` | `/soshiki/` |
| `madoguchi.html` | `/madoguchi/` |
| `ugoki.html` | `/ugoki/` |
| — | `/about/license/` |

内部リンクは双方向に直す必要がある。

- `index.html:123,128,133` の `soshiki.html` 等 → `soshiki/` 等
- **各ビューの「トップへ」リンク** — `soshiki.html:165` / `madoguchi.html:112` /
  `ugoki.html:121` はいずれも `href="index.html"` で、ディレクトリ化すると
  自分自身を指してしまう。`href="../"` に変える
- `index.html:154-159` の `data/` へのリンクは `index.html` がルートに残るため
  変更不要

このうちビュー側は見落としやすく、目視だと3ファイル分の確認が要る。§6 の
内部リンク検査で自動化し、以後の追加ページでも同じ事故が起きないようにする。

### 3.2 `scripts/build_dataset.js` の扱い

削除せず残す。`data/README.md:14` が生成経路として参照しており、v0.1 の
データがどう作られたかの記録になるため。ただしデータの流れが反転する以上、
ファイル冒頭に役割を終えた旨と後継（`tools/build.mjs` と `parse_reiki.py`）を
明記する。これがないと、次に読む人が現行の生成経路と取り違える。

## 4. データとビルドパイプライン

```
                    ┌──────────────────────────┐
  parse_reiki.py ─→ │ data/iki-seido-org.json  │ ← 唯一の正（条文由来）
      (v0.2)        └────────────┬─────────────┘
                                 │
  data/synonyms.yml ─────────────┤ （IKILAB著作・出典を分ける）
  data/scenarios.yml ────────────┤
                                 ▼
                      tools/view-model.mjs
                                 ▼
                      tools/build.mjs
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
            soshiki/index.html  ...      data/*.csv
```

### 4.1 生成の範囲

各HTMLのデータ節をマーカーで囲み、`tools/build.mjs` はその内側だけを
差し替える。描画ロジック・CSS・マークアップには触れない。

```html
<script>
/* @generated:begin — tools/build.mjs が data/ から生成。直接編集しないこと */
const SOURCES = { … };
const BRANCHES = [ … ];
/* @generated:end */
```

生成対象:

| ファイル | 生成する変数 |
|---|---|
| `soshiki/index.html` | `SOURCES`, `BRANCHES` |
| `madoguchi/index.html` | `SOURCES`, `BRANCHES`, `UNITS`, `SYN`, `SCENARIOS`, `expand()` |
| `ugoki/index.html` | `JOREI`, `KISOKU`, `KYOIKU` |
| `data/org_units.csv` | 全体 |
| `data/duties.csv` | 全体 |
| `data/amendments.csv` | 全体 |

現在の `const BRANCHES = []; BRANCHES.push(B_HONCHO); …` という組み立てコードは、
生成された配列リテラル1つに置き換わる。

### 4.2 `tools/view-model.mjs`

フラットな `org_units` / `duties` / `amendments` を、各ビューが要る形に変換する。
HTML 内に埋めるとテストできないため、独立したモジュールに切り出す。

| 関数 | 入力 | 出力 |
|---|---|---|
| `clsOf(unit, hasKids)` | ユニット1件 | `bu` / `ka` / `han` / `kyo` / `etc` |
| `buildBranches(units, duties)` | 全件 | `[{title, nodes:[{n, cls, legal, art, note, duties, kids}]}]` |
| `buildUnits(units, duties)` | 全件 | 逆引き検索用のフラット配列 |
| `buildAmendments(amendments)` | 全件 | `{JOREI, KISOKU, KYOIKU}`（タプル配列） |

`buildBranches` は `branch` 列で系統に分け（`branch` の値はビューの系統見出し
「市長部局 ─ 本庁(6部)」等と一致する）、`parent_id` で木を組み、`duties` を
`seq` 順に各ノードへ配る。

### 4.3 `clsOf` の変換規則

`level` → `cls` の逆変換は原理的に非可逆で、ここが本設計で最も壊れやすい箇所に
なる。教育委員会の課と市長部局の課はどちらも `level: 課` だが、元の HTML では
`cls` が `kyo` と `ka` に分かれている。`branch` 列で判別する。

| `level` | 条件 | `cls` |
|---|---|---|
| 部 | — | `bu` |
| 課 | `branch` が教育委員会事務局 | `kyo` |
| 課 | それ以外 | `ka` |
| 班 | `branch` が教育委員会事務局 | `kyo` |
| 班 | それ以外 | `han` |
| 室 | — | `han`（子を持つ） |
| 出先機関 | — | `etc` |

この表は現行データからの推定であり、§4.4 の検証を通るまで正しいとは見なさない。

### 4.4 移行の検証

変換規則が間違っていると、描画が例外を出さずに静かに壊れる。着手前に現行
3ファイルから §4.1 の生成対象の変数すべて（`SOURCES` / `BRANCHES` / `UNITS` /
`SYN` / `SCENARIOS` / `JOREI` / `KISOKU` / `KYOIKU`）を Node で評価し、
`tools/__fixtures__/v0.1-views.json` に凍結する。`expand()` は関数なので値では
凍結できない。`SYN` の全キーを入力したときの出力を凍結し、それで照合する。

そのうえで、**生成結果がこのスナップショットと完全一致することを確かめる
テストを、`view-model.mjs` を書く前に用意する。** 一致しなければ変換規則が
誤っているということなので、そこで `cls` を `data/` 側に持たせるなどの
修正を検討する（この場合はスキーマ変更になるため `datapackage.json` と
`data/README.md` も更新する）。

ROADMAP が `parse_reiki.py` に課している「移行判定は現行データセットとの
照合（96/597/57 一致）」と同じ作法を、ビュー側にも適用する。

**この照合は2つに分ける。** 同じスナップショットを恒久テストの期待値に
使い続けると、訂正・欠損収録・v0.2 のパーサ移行という**正当なデータ更新が
すべてテスト失敗になる**。データが動かないことを前提にした検査になってしまう。

| | 恒久テスト（`view-model.test.mjs`） | 今回限りの受け入れ条件 |
|---|---|---|
| 入力 | `__fixtures__/v0.1-data.json`（凍結） | 現在の `data/` |
| 期待値 | `__fixtures__/v0.1-views.json`（凍結） | 同左 |
| 意味 | 変換規則の回帰テスト | 移行でビューが変わっていないことの確認 |
| データ更新時 | 影響を受けない | 対象外（移行時のみ実施） |

恒久テストは入力と期待値の両方を凍結した純粋な変換テストなので、`data/` が
更新されても壊れない。壊れるのは変換規則を変えたときだけで、それは正しい。

今回限りの照合は §9 の受け入れ条件に置く。移行完了後は再実行しない。

### 4.5 決定性

CI が `git diff --exit-code` で生成漏れを検出するため、同じ入力からは常に
同じバイト列が出なければならない。

- キーの順序を固定する（オブジェクトの生成順に依存させない）
- インデントを固定する
- 改行は LF
- HTML と JSON は BOM なし
- **CSV は BOM 付きを維持する。** 現行の3本の CSV は BOM 付きで、Excel での
  文字化けを避けるためと見られる。配布物の互換性を落とさない。

### 4.6 却下した案

**案1: HTML の完全テンプレート化。** HTML 全体を `templates/` に移し、共通
ヘッダ・フッタ・免責を部品化して組み立てる（iki-keikaku の `build.mjs` 方式）。
却下の理由: 解きたい問題は「データが4箇所にある」ことであって「HTMLの共通部分が
3箇所にある」ことではない。前者は誤りが黙って残るが、後者はヘッダの文言が
ずれる程度で、ページが3枚のうちは目視で足りる。110KB のモックを解体する
過程で描画を壊すリスクに見合わない。ページが増えたら再検討する。

**案2: 各HTMLが実行時に `data/` を fetch する。** 却下の理由: 初回描画が
遅くなり、`file://` でのローカル確認ができなくなる。

**案3: 今回は据え置き、v0.2 でまとめて対応。** 却下の理由: 公開直後から
4箇所重複の保守負担を背負う。

## 5. データ検査（`tools/validate.mjs`）

iki-keikaku の error / warn 二段構えと `todo:` 規約を踏襲する。整合性の破れは
error、`todo:` を明記した未確定は warn で通す。iki-seido では「教育委員会規則の
条番号が未確定」がこれに当たり、`article: "todo: 条番号未確定"` と書けば CI は
通り、宿題としては可視化され続ける。

| 種別 | 内容 |
|---|---|
| error | `parent_id` の参照切れ・循環 |
| error | `id` の重複、採番形式（`u001…` / `d0001…`） |
| error | `duty_count` と duties の実件数の不一致 |
| error | `level` / `legal_source` / `branch` / `kind` の値域外 |
| error | 日付形式（YYYY-MM-DD）と暦としての妥当性 |
| error | `datapackage.json` のフィールド定義と CSV ヘッダの不一致 |
| error | `synonyms.yml` の項目が、展開先のどの語も条文に当たらない |
| error | `scenarios.yml` の検索語が、展開後に1件も当たらない |
| error | 総件数が 96 / 597 / 57 から変化 |
| warn | 必須項目の欠落に `todo:` が付いている |
| warn | `synonyms.yml` の個別の展開先で条文に当たらない語 |
| warn | `quality_notes` が空 |

### 5.1 同義語・シナリオの検査

辞書は v0.3 で人が育てていく前提のデータで、組織は毎年動く（規則39件中38件が
改正）ため、放っておけば必ず腐る。ただし現行の `SYN` は「検索語 → 条文語」の
対応表、`SCENARIOS` は `{label, q}` であって、**どちらも部署 ID や部署名を
参照していない。** したがって「実在しない課・班への参照」は検査できない。
参照を検査するには期待する `unit_ids` を YAML に持たせることになるが、それは
期待結果を人が手で保守することを意味し、辞書本体より早く腐る。

代わりに**条文テキストへの到達性**を検査する。辞書項目が1語も条文に当たらなければ、
その項目は逆引き検索で黙ってゼロヒットを返す死んだ項目である。

現行データで試したところ、`SYN` の展開先86語のうち条文に当たらないのは
「空き家」「長寿」の2語だけで、どちらも同じ項目の別の語（「危険家屋」「高齢者」）が
当たるため項目としては生きている。よって**項目単位を error、語単位を warn** と
段階を分ける。この基準なら現状は error 0 / warn 2 で通る。

`SCENARIOS` は8本すべてで全検索語がヒットしたので、こちらは語単位で error にできる。

検査には `SYN` の展開処理が要る。この処理は現在 `madoguchi.html:363` の
`expand()` にあり、検査側と HTML 側に同じロジックが2つあると必ずずれる。
`tools/search.mjs` に置き、**`expand()` を §4.1 の生成範囲に含めて HTML へ
書き出す**ことで実体を1つに保つ。生成範囲がデータ節から関数1つ分だけ広がるが、
2重実装を抱えるより安全である。

v0.4 で iki-keikaku 側に作るドリフト検知と同じ発想の、自プロジェクト内版にあたる。

総件数の固定（96/597/57）は、パーサが動き出すまでのデータ差し替え事故の
安全装置である。v0.2 のパーサ移行時には、この数字を意図的に更新する。

## 6. CI

### `.github/workflows/build.yml`

push と PR、`workflow_dispatch` で発火。発火パスは次のとおり。

```yaml
paths:
  - 'data/**'
  - 'tools/**'
  - 'index.html'          # ルート。*/index.html では一致しない
  - '*/index.html'        # soshiki/ madoguchi/ ugoki/
  - 'about/**/index.html'
  - '.github/workflows/build.yml'
```

GitHub Actions の `paths` では `*` が `/` に一致しないため、`*/index.html` だけ
だとルートの `index.html` を拾わない。今回の URL 変更の中心にあるファイルなので、
明示的に列挙する。ワークフロー自身も含め、CI の変更が CI で検証されるようにする。

1. `node --test`
2. `node tools/validate.mjs`
3. `node tools/linkmap.mjs`
4. `node tools/build.mjs`
5. `git diff --exit-code`

5 が生成漏れの検出で、データだけ直して生成を忘れたコミットを止める。外部依存が
ないので `npm install` は不要。

### 内部リンク検査（`tools/linkmap.mjs`）

すべての HTML から相対 `href` を集め、リンク先がファイルとして実在するかを
確かめる。ディレクトリ指定（`../` や `soshiki/`）は `index.html` に解決する。

これは §3.1 の「トップへ」リンクのような事故を機械的に止めるための検査である。
ディレクトリ化に伴う相対パスのずれは、リンクが 404 になるだけでビルドもテストも
通ってしまうため、目視以外に気づく手段がない。ページが増えるほど確認箇所が
増えるので、最初から自動化しておく。外部URL（`http://`・`https://`）は
linkcheck の担当なので対象外。

### `.github/workflows/linkcheck.yml`

毎週月曜 6:00 JST（cron `0 21 * * 0`）と `workflow_dispatch`、および
`tools/linkcheck.mjs` への push で発火。例規3ページの死活を確認し、失効時に
Issue を立てる（`issues: write` 権限）。iki-keikaku の実装を流用するが、
UA 文字列は `iki-seido-linkcheck` に変える（UA なしだと bot 対策で 403 を返す
サーバがある、という知見が向こうのコメントに残っている）。404 だけでなく
「200 を返すが本文が空」も失効として扱う点も引き継ぐ。

**担当範囲の線引き:** linkcheck が見るのは到達性だけで、内容の変化＝改正の
検知は iki-watch の担当である。ここで内容比較を始めると iki-watch と二重になる。

## 7. ドキュメント

`LICENSE`（CC BY 4.0 法文）と `LICENSE-CODE`（MIT）は法文そのものなので
iki-keikaku から複製する。残りは iki-seido 用に書き起こす。

### 7.1 `NOTICE.md`

iki-keikaku にない説明が要る。向こうは計画書の分析なので「引用元の著作権は
各機関に帰属」で足りるが、こちらは条文が主成分で、**条例・規則の本文は
著作権法13条により権利の目的とならない**。この線引きを書かないと、利用者は
条文の再利用にまでクレジットが要ると誤解する。方針は `data/README.md:44` に
既にあるので、それを正式化する。

ただし**「597件はすべて権利の対象外」とは書かない。** 支所・事務所・会計課の
分掌事務は原文の列挙をそのまま写したものではなく IKILAB が要約したもので
（§7.2 の既知の限界1）、要約・選択・編集まで一律に13条の対象外と言い切ることは
できない。§7.2 の3区分と揃えて、次のように限定する。

- **公式の条例・規則の本文をそのまま転記した部分** — 著作権法13条により権利の
  目的とならず、二次利用は法的に自由
- **IKILAB による要約・編集・構造化（ID体系・階層・分類・概要化した記述）** —
  CC BY 4.0 の対象

どのユニットが要約にあたるかは `NOTICE.md` に名指しで書く（支所4・事務所
グループ・福祉事務所・会計課）。レコード単位で機械判別できるフラグを持たせるかは
スキーマ変更になるため §10 の申し送りとする。

`synonyms.yml` / `scenarios.yml` は IKILAB の著作物として CC BY 4.0 の対象で
あることを、条文由来データと分けて明記する。

### 7.2 `DISCLAIMER.md`

区分は iki-keikaku と変える。向こうの「確認済み事実 / 推計 / 仮説・論点」は
分析系の区分で、条文の転記であるこちらには合わない。

| 区分 | 意味 |
|---|---|
| 条文の転記 | 例規本文にそのまま書かれている文言 |
| 構造化の解釈 | 条文を読んで IKILAB が起こした階層・分類・ID |
| 未確認 | 原文にあたれていない、または内容が特定できていない箇所 |

既知の限界4件を「未確認」として名指しで書く。

1. 支所・事務所・会計課の分掌事務は概要のみ（原文は支所だけで約69号）
2. 教育委員会規則の分掌事務の条番号が未確定
3. 沿革の `recorded_on` は公布日と施行日が混在している可能性
4. 令和8年3月19日条例第4号は沿革にあるが本文ページに附則が見当たらない

基準日は例規ページの取得日 2026年8月11日。公式は例規本文である旨の導線を常設する。

### 7.3 `.github/ISSUE_TEMPLATE`

- `correction.md` — 誤りの指摘
- `not-found.md` — 探したのに見つからなかった言葉

2本目は ROADMAP v0.3 の「ゼロヒットクエリの収集」への受け皿である。「市民の
言葉と条文の言葉のギャップこそ最大の資産」と位置づけられているので、公開初日から
置く。iki-keikaku の `new-plan.md` に相当する枠をこれに充てる。

### 7.4 その他

`README.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `SETUP.md` /
`about/license/index.html` は iki-keikaku の構成に沿った書き起こし。
`CHANGELOG.md` は v0.1.0 から起こす。`CONTRIBUTING.md` には `todo:` 規約と
ビルドの回し方を含める。

## 8. 公開手順

コミットは3段に分ける。

1. **現状をそのまま記録**（実施済み・commit `v0.1 の試作をそのまま記録する`）
2. **生成方式への移行** — URL変更、データ分離、`tools/` 一式、CI
3. **ドキュメント整備** — ライセンス群、README、CHANGELOG 等

この順なら、2 の diff がそのまま「何を機械生成に置き換えたか」の記録になる。
逆順だと移行の中身がドキュメント追加に埋もれる。

| # | 手順 | 実行者 |
|---|---|---|
| 1 | `git init` 〜 3段のコミット | Claude |
| 2 | `ikilab-org/iki-seido` を公開で作成し push | Claude（実行前に確認） |
| 3 | Pages を有効化（main / root） | Claude または利用者 |
| 4 | `CNAME` = `seido.ikilab.org` を配置 | Claude |
| 5 | DNS に `seido` → `ikilab-org.github.io` の CNAME を追加 | **利用者**（ドメイン管理画面） |
| 6 | HTTPS 強制の確認と到達確認 | Claude |

5 は Claude からは実施できないため、そこで一度手が止まる。

## 9. 受け入れ条件

**恒久的に満たすもの**（CI で検証し続ける）

- `node --test` が全て通る
- `node tools/validate.mjs` が error 0 で終わる（warn は §5.1 の2件を許容）
- `node tools/linkmap.mjs` が未解決リンク 0 で終わる
- `node tools/build.mjs` の実行後に `git diff` が空

**今回の移行時にだけ確認するもの**（一度限り・恒久テストにはしない）

- 現在の `data/` から生成した §4.1 の変数すべてが
  `tools/__fixtures__/v0.1-views.json` と完全一致
- `data/*.csv` の内容が移行前と一致（BOM を含む）
- 3ビューがブラウザで移行前と同じ描画・同じ検索結果を返す
- `index.html` から3ビューと `about/license/` へ、各ビューから `../` へ到達する
- `https://seido.ikilab.org/` が3ビューを配信する

## 10. v0.2 への申し送り

- `parse_reiki.py` の本実装。`data/iki-seido-org.json` を出力すればビルド経路は
  無変更で繋がる
- 総件数の固定値（96/597/57）は、欠損データ収録時に更新が必要
- `cache/` を git 追跡するかの判断（ROADMAP のリスク対策「キャッシュを常に
  保持し、取得日を記録」との兼ね合い）
- 要約にあたるレコードを機械判別するフラグの追加（§7.1）。欠損収録で要約が
  原文に置き換わるため、v0.2 のスキーマ見直しと同時に判断するのが自然
- 逆引き検索を Turso ハイブリッド検索に載せ替える際（ROADMAP v0.3）、
  §5.1 の到達性検査を新しい検索基盤に合わせて作り直す
- ページが増えた段階で、HTML の完全テンプレート化（§4.6 案1）を再検討
