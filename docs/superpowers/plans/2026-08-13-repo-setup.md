# iki-seido リポジトリ整備 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iki-seido を `data/` を単一のデータ源とする構成に組み替え、規約ファイルとCIを整えて `seido.ikilab.org` として公開する。

**Architecture:** `data/iki-seido-org.json` を唯一の正とし、3つのビューHTMLのデータ節と `data/*.csv` を `tools/build.mjs` の生成物にする。ビューの描画ロジック・CSS には触れず、`@generated` マーカーで囲んだ区間だけを書き戻す。変換ロジックは `tools/view-model.mjs` に切り出してテスト可能にする。

**Tech Stack:** Node.js 20（ESM `.mjs`）、`node --test` + `node:assert/strict`、外部依存ゼロ、GitHub Actions、GitHub Pages

設計文書: [docs/superpowers/specs/2026-08-13-repo-setup-design.md](../specs/2026-08-13-repo-setup-design.md)

## Global Constraints

- **外部依存を追加しない。** `npm install` なしで全ツールとテストが動くこと。`node:` 標準モジュールのみ使う
- **コードスタイルは iki-keikaku に合わせる。** ESM、セミコロンなし、シングルクォート、2スペースインデント
- **CLI は直接実行時だけ動かす。** `if (fileURLToPath(import.meta.url) === process.argv[1]) { … }` で囲む（テストから import しても走らないため）
- **生成は決定的に。** 同じ入力からは常に同じバイト列。オブジェクトのキー順を固定し、改行は LF
- **CSV は BOM 付き・LF・末尾改行あり。** 現行3本と同じ。フィールドにカンマ・引用符・改行が現れたときだけ RFC4180 の引用を行う（現行データでは1件も該当しないため、引用処理を入れてもバイト列は変わらない）
- **HTML と JSON は BOM なし**
- **教育委員会の系統名は `教育委員会事務局(市長部局とは別系統)`。** `org_units.csv` の `branch` 列の値であり、ビューの系統見出しと完全に一致する
- **コミットメッセージは日本語。** 件名は「〜する」、本文に判断の理由を書く。末尾に `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## File Structure

**新規作成**

| ファイル | 責務 |
|---|---|
| `tools/yaml.mjs` | YAML読み取り（iki-keikaku から流用） |
| `tools/view-model.mjs` | フラットな `org_units` → ビュー用の木構造 |
| `tools/search.mjs` | 同義語の展開。ブラウザ側の `expand()` の実体もここ |
| `tools/build.mjs` | `data/` → HTMLのデータ節・CSV の生成 |
| `tools/validate.mjs` | データ検査 |
| `tools/linkmap.mjs` | 内部リンクの解決検査 |
| `tools/linkcheck.mjs` | 例規ページの死活確認 |
| `tools/__fixtures__/v0.1-data.json` | 変換テストの入力（凍結） |
| `tools/__fixtures__/v0.1-views.json` | 変換テストの期待値（凍結） |
| `data/synonyms.yml` | 同義語辞書71語（IKILAB著作） |
| `data/scenarios.yml` | ライフイベント8シナリオ（同上） |
| `.github/workflows/build.yml` | 生成漏れ・検査 |
| `.github/workflows/linkcheck.yml` | 例規URLの死活 |
| `.github/ISSUE_TEMPLATE/correction.md` | 誤りの指摘 |
| `.github/ISSUE_TEMPLATE/not-found.md` | 探して見つからなかった言葉 |
| `LICENSE` / `LICENSE-CODE` / `NOTICE.md` / `DISCLAIMER.md` | ライセンスと免責 |
| `README.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `SETUP.md` | 説明文書 |
| `about/license/index.html` | ライセンス解説ページ |
| `CNAME` / `.nojekyll` | Pages 設定 |

**移動・変更**

| 変更 | 内容 |
|---|---|
| `soshiki.html` → `soshiki/index.html` | データ節をマーカーで囲む・トップへのリンクを `../` に |
| `madoguchi.html` → `madoguchi/index.html` | 同上 |
| `ugoki.html` → `ugoki/index.html` | 同上 |
| `index.html` | 3ビューへのリンクをディレクトリ形式に |
| `data/datapackage.json` | `resource.path` から `data/` を落とす |
| `data/iki-seido-org.json` | `quality_notes` の会計課の記述を訂正 |
| `data/README.md` | 生成経路の説明を更新 |
| `scripts/build_dataset.js` | 冒頭に役割終了の注記 |

---

### Task 1: v0.1 スナップショットの凍結

移行の正しさを測る基準を、何かを変える前に固定する。これ以降のすべてのタスクがこの
fixture を期待値として使う。

**Files:**
- Create: `tools/__fixtures__/v0.1-data.json`
- Create: `tools/__fixtures__/v0.1-views.json`
- Create: `tools/__fixtures__/README.md`

**Interfaces:**
- Consumes: なし
- Produces: `v0.1-data.json`（`data/iki-seido-org.json` と同一構造）、`v0.1-views.json`（`{soshiki:{SOURCES,BRANCHES}, madoguchi:{SOURCES,BRANCHES,UNITS,SYN,SCENARIOS,expand}, ugoki:{JOREI,KISOKU,KYOIKU}}`。`expand` は `SYN` の全キーを入力したときの出力表）

- [ ] **Step 1: 入力側の凍結**

```bash
mkdir -p tools/__fixtures__
cp data/iki-seido-org.json tools/__fixtures__/v0.1-data.json
```

- [ ] **Step 2: ビュー側の凍結**

各HTMLの `<script>` から、最初に `document.` が現れる行の直前までを切り出して評価する。
データ宣言はすべてその手前にあることを確認済み（soshiki:373 / madoguchi:368 / ugoki:239）。
行頭で切らないと `const treeEl = ` が宙に浮いて構文エラーになる。

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs"
import { runInNewContext } from "node:vm"

const TARGETS = [
  ["soshiki", ["SOURCES", "BRANCHES"]],
  ["madoguchi", ["SOURCES", "BRANCHES", "UNITS", "SYN", "SCENARIOS"]],
  ["ugoki", ["JOREI", "KISOKU", "KYOIKU"]],
]
const out = {}
for (const [name, vars] of TARGETS) {
  const script = readFileSync(`${name}.html`, "utf8").split("<script>")[1].split("</script>")[0]
  const head = script.slice(0, script.lastIndexOf("\n", script.indexOf("document.")))
  const ctx = {}
  runInNewContext(`${head}\n;globalThis.__out = {${vars.join(",")}}`, ctx)
  out[name] = ctx.__out
  if (name === "madoguchi") {
    const ctx2 = {}
    runInNewContext(`${head}\n;globalThis.__e = Object.fromEntries(Object.keys(SYN).map(k => [k, expand(k)]))`, ctx2)
    out[name].expand = ctx2.__e
  }
}
writeFileSync("tools/__fixtures__/v0.1-views.json", JSON.stringify(out, null, 2) + "\n")
'
```

- [ ] **Step 3: 凍結した中身を確認**

```bash
node -e '
const v = require("./tools/__fixtures__/v0.1-views.json")
console.log("soshiki.BRANCHES", v.soshiki.BRANCHES.length)
console.log("madoguchi.UNITS", v.madoguchi.UNITS.length)
console.log("madoguchi.SYN", Object.keys(v.madoguchi.SYN).length)
console.log("madoguchi.SCENARIOS", v.madoguchi.SCENARIOS.length)
console.log("ugoki", v.ugoki.JOREI.length, v.ugoki.KISOKU.length, v.ugoki.KYOIKU.length)
'
```

期待する出力:

```
soshiki.BRANCHES 4
madoguchi.UNITS 60
madoguchi.SYN 71
madoguchi.SCENARIOS 8
ugoki 9 39 9
```

- [ ] **Step 4: fixture の位置づけを書き残す**

`tools/__fixtures__/README.md`:

```markdown
# 凍結スナップショット

v0.1（LLM支援の半手動抽出）の入力と出力を、生成方式へ移行する前に固定したもの。

| ファイル | 中身 |
|---|---|
| `v0.1-data.json` | 移行前の `data/iki-seido-org.json` |
| `v0.1-views.json` | 移行前の3ビューHTMLから評価した変数の値 |

**この2つは書き換えない。** `view-model.mjs` の変換テストは、入力と期待値の
両方をここから取る純粋な変換テストであり、`data/` が更新されても影響を受けない。
壊れるのは変換規則そのものを変えたときだけで、それは正しい。

`data/` の訂正・欠損収録・v0.2 のパーサ移行でこのファイルを更新する必要はない。
更新したくなったら、それは変換規則を変えたということなので、テストの期待値ではなく
テストの意図を先に見直すこと。
```

- [ ] **Step 5: コミット**

```bash
git add tools/__fixtures__
git commit -m "$(cat <<'EOF'
移行前の v0.1 スナップショットを凍結する

生成方式へ移行する前に、入力（data/iki-seido-org.json）と出力（3ビューHTMLの
データ節を評価した値）を固定する。以降の view-model.mjs は、この入力から
この出力が再現できることをもって正しいと判定する。

ビュー側の抽出は <script> の先頭から最初に document. が現れる行の直前までを
評価した。データ宣言はすべてその手前にある（soshiki:373 / madoguchi:368 /
ugoki:239）。行頭で切らないと代入文の途中で切れて構文エラーになる。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: YAML読み取りの流用

`data/synonyms.yml` / `scenarios.yml` を読むために必要。外部依存を増やさないため、
iki-keikaku の実装をコピーする。

**Files:**
- Create: `tools/yaml.mjs`（`/Users/yet2come/Projects/iki-keikaku/tools/yaml.mjs` の複製）
- Create: `tools/yaml.test.mjs`（同 `tools/yaml.test.mjs` の複製）

**Interfaces:**
- Consumes: なし
- Produces: `parseYaml(text) -> object`、`stripComment(s)`、`parseScalar(s)`、`parseValue(s)`

- [ ] **Step 1: コピー**

```bash
cp /Users/yet2come/Projects/iki-keikaku/tools/yaml.mjs tools/yaml.mjs
cp /Users/yet2come/Projects/iki-keikaku/tools/yaml.test.mjs tools/yaml.test.mjs
```

- [ ] **Step 2: テストを走らせる**

```bash
node --test tools/yaml.test.mjs
```

期待: 全テスト pass。失敗する場合はコピー元が iki-keikaku 固有の相対 import を
持っている可能性があるので、`import` 行を確認して `./yaml.mjs` に直す。

- [ ] **Step 3: 出所を書き添える**

`tools/yaml.mjs` の冒頭コメントに1行足す:

```js
// iki-keikaku（https://github.com/ikilab-org/iki-keikaku）から複製。
// 外部依存を増やさないための最小YAMLパーサで、両プロジェクトで同じ実装を使う。
```

- [ ] **Step 4: コミット**

```bash
git add tools/yaml.mjs tools/yaml.test.mjs
git commit -m "$(cat <<'EOF'
YAML読み取りを iki-keikaku から流用する

data/synonyms.yml・data/scenarios.yml を外部依存なしで読むため。
両プロジェクトで同じ実装を使う旨を冒頭に明記した。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 同義語辞書とシナリオの分離

条文由来でないデータを `data/` の独立したファイルに出す。権利関係が条文と異なる
（著作権法13条が及ばず CC BY 4.0 の対象）ため、出典を分けて示す必要がある。

**Files:**
- Create: `data/synonyms.yml`
- Create: `data/scenarios.yml`
- Create: `tools/dictionaries.test.mjs`

**Interfaces:**
- Consumes: `parseYaml`（Task 2）、`v0.1-views.json`（Task 1）
- Produces: `data/synonyms.yml`（`{検索語: [条文語, …]}` 71項目）、`data/scenarios.yml`（`[{label, q}]` 8件）

- [ ] **Step 1: 失敗するテストを書く**

`tools/dictionaries.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseYaml } from './yaml.mjs'

const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/v0.1-views.json', import.meta.url), 'utf8'))
const read = (f) => parseYaml(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'))

test('synonyms.yml は v0.1 の SYN と同じ内容を持つ', () => {
  assert.deepEqual(read('synonyms.yml').synonyms, fixture.madoguchi.SYN)
})

test('scenarios.yml は v0.1 の SCENARIOS と同じ内容を持つ', () => {
  assert.deepEqual(read('scenarios.yml').scenarios, fixture.madoguchi.SCENARIOS)
})
```

- [ ] **Step 2: 失敗を確認**

```bash
node --test tools/dictionaries.test.mjs
```

期待: `ENOENT: no such file or directory` で FAIL（`data/synonyms.yml` が無い）。

- [ ] **Step 3: fixture から YAML を書き出す**

手で書き写すと転記ミスが入るので、凍結済みの値から生成する。

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs"
const v = JSON.parse(readFileSync("tools/__fixtures__/v0.1-views.json", "utf8")).madoguchi
const q = (s) => `"${String(s).replace(/"/g, "\\\"")}"`

const syn = [
  "# 市民の言葉 → 条文の言葉",
  "#",
  "# 例規の条文にない語で探されたときに、条文側の語へ橋渡しするための辞書。",
  "# 条文由来ではなく IKILAB が書いたものなので、著作権法13条の対象外ではなく",
  "# CC BY 4.0 の対象。出典が異なるため data/iki-seido-org.json とは別ファイルに置く。",
  "#",
  "# 追加するときは、展開先の語が実際に分掌事務の文言に現れることを確かめること。",
  "# どの語も当たらない項目は逆引き検索で黙ってゼロヒットを返す。",
  "# tools/validate.mjs がこれを検査する。",
  "",
  "synonyms:",
  ...Object.entries(v.SYN).map(([k, arr]) => `  ${q(k)}: [${arr.map(q).join(", ")}]`),
].join("\n") + "\n"

const sc = [
  "# ライフイベントから引くための入口",
  "#",
  "# label は市民が自分の状況として選ぶ言葉、q はそれを検索窓に入れる語の並び。",
  "# synonyms.yml と同じく IKILAB の著作物（CC BY 4.0）。",
  "",
  "scenarios:",
  ...v.SCENARIOS.map((s) => `  - label: ${q(s.label)}\n    q: ${q(s.q)}`),
].join("\n") + "\n"

writeFileSync("data/synonyms.yml", syn)
writeFileSync("data/scenarios.yml", sc)
'
```

- [ ] **Step 4: テストが通ることを確認**

```bash
node --test tools/dictionaries.test.mjs
```

期待: 2件とも PASS。

- [ ] **Step 5: コミット**

```bash
git add data/synonyms.yml data/scenarios.yml tools/dictionaries.test.mjs
git commit -m "$(cat <<'EOF'
同義語辞書とライフイベントを data/ に分離する

madoguchi.html に埋め込まれていた SYN（71語）と SCENARIOS（8件）を
data/synonyms.yml・data/scenarios.yml に出した。

この2つは条文由来ではなく IKILAB が書いたものなので、著作権法13条により
権利の目的とならない条文とは権利関係が異なる（CC BY 4.0 の対象）。
出典を分けて示すため、iki-seido-org.json とは別ファイルにした。

手で書き写すと転記ミスが入るため、凍結済みの fixture から生成し、
読み戻して元と一致することをテストで確かめている。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: ビューモデルへの変換

`data/` のフラットな構造を、各ビューが描画に使う形へ変換する。本計画で最も壊れやすい
箇所で、`level` → `cls` の逆変換が原理的に非可逆（教委の課と市長部局の課はどちらも
`level: 課`）。fixture との照合を先に書いて縛る。

**Files:**
- Create: `tools/view-model.mjs`
- Create: `tools/view-model.test.mjs`

**Interfaces:**
- Consumes: `v0.1-data.json` / `v0.1-views.json`（Task 1）
- Produces:
  - `clsOf(unit) -> 'bu'|'ka'|'han'|'kyo'|'etc'`
  - `buildBranches(units, duties) -> [{title, nodes}]`（`nodes` の各要素は `{n, cls, legal, art, note?, duties?, kids?}`）
  - `buildUnits(branches) -> [{name, path, top, legal, art, duties, branch}]`
  - `buildAmendments(amendments) -> {JOREI, KISOKU, KYOIKU}`
  - `buildSources() -> {jorei, kisoku, kyoiku}`

- [ ] **Step 1: 失敗するテストを書く**

`tools/view-model.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clsOf, buildBranches, buildUnits, buildAmendments, buildSources } from './view-model.mjs'

const read = (f) => JSON.parse(readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), 'utf8'))
const data = read('v0.1-data.json')
const views = read('v0.1-views.json')

test('clsOf は教育委員会の課と市長部局の課を branch で見分ける', () => {
  const KYOIKU = '教育委員会事務局(市長部局とは別系統)'
  assert.equal(clsOf({ level: '部', branch: '市長部局 ─ 本庁(6部)' }), 'bu')
  assert.equal(clsOf({ level: '課', branch: '市長部局 ─ 本庁(6部)' }), 'ka')
  assert.equal(clsOf({ level: '課', branch: KYOIKU }), 'kyo')
  assert.equal(clsOf({ level: '班', branch: '市長部局 ─ 本庁(6部)' }), 'han')
  assert.equal(clsOf({ level: '班', branch: KYOIKU }), 'kyo')
  assert.equal(clsOf({ level: '室', branch: '市長部局 ─ 本庁(6部)' }), 'han')
  assert.equal(clsOf({ level: '出先機関', branch: '出先機関(市長部局)' }), 'etc')
})

test('clsOf は未知の level を握り潰さない', () => {
  assert.throws(() => clsOf({ level: '局', branch: 'x' }), /未知の level/)
})

test('buildBranches が v0.1 の BRANCHES を再現する', () => {
  assert.deepEqual(buildBranches(data.organization, data.duties), views.soshiki.BRANCHES)
})

test('buildUnits が v0.1 の UNITS を再現する', () => {
  const branches = buildBranches(data.organization, data.duties)
  assert.deepEqual(buildUnits(branches), views.madoguchi.UNITS)
})

test('buildAmendments が v0.1 の沿革3本を再現する', () => {
  const a = buildAmendments(data.amendments)
  assert.deepEqual(a.JOREI, views.ugoki.JOREI)
  assert.deepEqual(a.KISOKU, views.ugoki.KISOKU)
  assert.deepEqual(a.KYOIKU, views.ugoki.KYOIKU)
})

test('buildSources が v0.1 の SOURCES を再現する', () => {
  assert.deepEqual(buildSources(), views.soshiki.SOURCES)
})
```

- [ ] **Step 2: 失敗を確認**

```bash
node --test tools/view-model.test.mjs
```

期待: `Cannot find module` で FAIL。

- [ ] **Step 3: 実装する**

`tools/view-model.mjs`:

```js
/**
 * data/iki-seido-org.json のフラットな構造を、各ビューが描画に使う形へ変換する。
 *
 * HTML の中に置くとテストできないため独立させている。tools/build.mjs がこれを
 * 呼んで各ビューのデータ節を生成する。変換が正しいかどうかは、移行前に凍結した
 * tools/__fixtures__/ との照合で判定する（tools/view-model.test.mjs）。
 */

/** 教育委員会事務局の系統名。org_units の branch 列の値と完全一致する */
const KYOIKU_BRANCH = '教育委員会事務局(市長部局とは別系統)'

/** 例規3本の書誌。条文そのものではなく表示用の定数なのでここに置く */
const SOURCES = {
  jorei: {
    name: '壱岐市行政組織条例',
    url: 'https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000958.html',
    era: '平成23年条例第1号(令和7年6月1日施行)',
  },
  kisoku: {
    name: '壱岐市行政組織規則',
    url: 'https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html',
    era: '平成16年規則第2号(令和7年6月1日施行)',
  },
  kyoiku: {
    name: '壱岐市教育委員会事務局組織規則',
    url: 'https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000190.html',
    era: '平成16年教育委員会規則第5号(平成31年4月1日施行)',
  },
}

export function buildSources() {
  return structuredClone(SOURCES)
}

/**
 * level から表示用のクラスを決める。
 *
 * 逆変換は原理的に非可逆で、教委の課と市長部局の課はどちらも level:課 になる。
 * branch で見分ける。子の有無は使わない（level が 室 と 班 を既に分けているため）。
 */
export function clsOf(unit) {
  switch (unit.level) {
    case '部': return 'bu'
    case '課': return unit.branch === KYOIKU_BRANCH ? 'kyo' : 'ka'
    case '班': return unit.branch === KYOIKU_BRANCH ? 'kyo' : 'han'
    case '室': return 'han'
    case '出先機関': return 'etc'
    default: throw new Error(`未知の level: ${unit.level}`)
  }
}

/**
 * 系統ごとの木を組む。系統の並びは org_units の出現順に従う
 * （= 市長部局 → 会計 → 出先機関 → 教委）。
 */
export function buildBranches(units, duties) {
  const dutiesOf = new Map()
  for (const d of [...duties].sort((a, b) => a.seq - b.seq)) {
    if (!dutiesOf.has(d.unit_id)) dutiesOf.set(d.unit_id, [])
    dutiesOf.get(d.unit_id).push(d.text)
  }

  const childrenOf = new Map()
  for (const u of units) {
    if (!u.parent_id) continue
    if (!childrenOf.has(u.parent_id)) childrenOf.set(u.parent_id, [])
    childrenOf.get(u.parent_id).push(u)
  }

  const toNode = (u) => {
    const node = { n: u.name, cls: clsOf(u), legal: u.legal_source, art: u.article }
    if (u.note) node.note = u.note
    const ds = dutiesOf.get(u.id)
    if (ds && ds.length) node.duties = ds
    const kids = childrenOf.get(u.id)
    if (kids && kids.length) node.kids = kids.map(toNode)
    return node
  }

  const branches = []
  const byTitle = new Map()
  for (const u of units) {
    if (!byTitle.has(u.branch)) {
      const b = { title: u.branch, nodes: [] }
      byTitle.set(u.branch, b)
      branches.push(b)
    }
    if (!u.parent_id) byTitle.get(u.branch).nodes.push(toNode(u))
  }
  return branches
}

/**
 * 逆引き検索が舐めるフラットな一覧。分掌事務を持つノードだけを拾い、
 * 部は除く（部の事務は条例の大分掌で、課・班の事務と粒度が違うため）。
 */
export function buildUnits(branches) {
  const out = []
  const walk = (node, trail, branchTitle) => {
    if (node.duties && node.duties.length && node.cls !== 'bu') {
      out.push({
        name: node.n,
        path: trail.join(' › '),
        top: trail[0] || node.n,
        legal: node.legal,
        art: node.art || '',
        duties: node.duties,
        branch: branchTitle,
      })
    }
    for (const k of node.kids || []) walk(k, trail.concat(node.n), branchTitle)
  }
  for (const b of branches) for (const n of b.nodes) walk(n, [], b.title)
  return out
}

/**
 * 沿革をタプル配列にする。条例は公布日と施行日を持ち、規則・教委規則は
 * 沿革記載日のみを持つため、列の数が違う。
 */
export function buildAmendments(amendments) {
  const pick = (source) => amendments.filter((a) => a.source === source)
  const kindOf = (a) => (a.kind === '改正' ? null : a.kind)

  const jorei = pick('jorei').map((a) => [a.promulgated_on, a.enforced_on ?? null, a.number, kindOf(a)])
  const dated = (source) => pick(source).map((a) => {
    const row = [a.recorded_on, a.number]
    const k = kindOf(a)
    if (k !== null) row.push(k)
    return row
  })

  return { JOREI: jorei, KISOKU: dated('kisoku'), KYOIKU: dated('kyoiku') }
}
```

- [ ] **Step 4: テストを走らせる**

```bash
node --test tools/view-model.test.mjs
```

期待: 6件すべて PASS。

失敗したときの読み方 ─ `buildBranches` の差分が出たら、まず `clsOf` の分岐を疑う。
`assert.deepEqual` の出力で `cls` の値だけがずれていれば §4.3 の表が誤りなので、
`org_units` 側に `cls` を持たせる案（設計文書 §4.4）へ切り替える判断になる。
その場合は `data/datapackage.json` と `data/README.md` のスキーマ記述も直すこと。

- [ ] **Step 5: コミット**

```bash
git add tools/view-model.mjs tools/view-model.test.mjs
git commit -m "$(cat <<'EOF'
フラットな組織データをビュー用の木構造に変換する

data/ を単一のデータ源にするための中核。org_units の parent_id で木を組み、
duties を seq 順に配り、branch で系統に分ける。

level から表示クラスへの逆変換は非可逆で、教委の課と市長部局の課はどちらも
level:課 になる。branch で見分けている。子の有無は使わない ─ level が
室 と 班 を既に分けているため、build_dataset.js が順方向で使っていた
kids の判定は逆方向では不要だった。

正しさは移行前に凍結した fixture との照合で判定している。入力・期待値とも
凍結されているので、data/ を訂正してもこのテストは影響を受けない。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 同義語の展開

検査側とブラウザ側で同じ展開ロジックが2つあると必ずずれる。実体をここに1つ置き、
ブラウザ用は `Function.prototype.toString()` で書き出す。

**Files:**
- Create: `tools/search.mjs`
- Create: `tools/search.test.mjs`

**Interfaces:**
- Consumes: `v0.1-views.json`（Task 1）
- Produces: `expand(token, syn) -> string[]`、`browserExpandSource() -> string`

- [ ] **Step 1: 失敗するテストを書く**

`tools/search.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expand, browserExpandSource } from './search.mjs'

const views = JSON.parse(readFileSync(new URL('./__fixtures__/v0.1-views.json', import.meta.url), 'utf8'))
const SYN = views.madoguchi.SYN

test('expand が v0.1 の全キーで同じ展開結果を返す', () => {
  for (const [key, expected] of Object.entries(views.madoguchi.expand)) {
    assert.deepEqual(expand(key, SYN), expected, `キー: ${key}`)
  }
})

test('辞書に無い語は部分一致で拾う', () => {
  assert.deepEqual(expand('ごみ出し', { 'ごみ': ['廃棄物'] }), ['ごみ出し', '廃棄物'])
})

test('辞書にも部分一致にも無い語は自分だけを返す', () => {
  assert.deepEqual(expand('量子力学', SYN), ['量子力学'])
})

test('ブラウザ用の出力が Node 側と同じ結果を返す', () => {
  const ctx = { SYN }
  runInNewContext(`${browserExpandSource()}\n;globalThis.__r = expand('引っ越し')`, ctx)
  assert.deepEqual(ctx.__r, expand('引っ越し', SYN))
})
```

- [ ] **Step 2: 失敗を確認**

```bash
node --test tools/search.test.mjs
```

期待: `Cannot find module` で FAIL。

- [ ] **Step 3: 実装する**

`tools/search.mjs`:

```js
/**
 * 市民の言葉を条文の言葉へ広げる。
 *
 * 実体はこの1箇所だけに置く。ブラウザ側にも同じ処理が要るが、コピーを置くと
 * 必ずずれるので、tools/build.mjs が browserExpandSource() の出力を
 * madoguchi/index.html の生成区間へ書き出す。
 */

/**
 * 辞書に完全一致すればその展開先を、無ければ辞書のキーを部分一致で探して
 * 引っかかったものの展開先を足す。入力語そのものは常に残す。
 */
export function expand(token, syn) {
  const out = new Set([token])
  if (syn[token]) {
    for (const t of syn[token]) out.add(t)
  } else {
    for (const k of Object.keys(syn)) {
      if (token.indexOf(k) >= 0) for (const t of syn[k]) out.add(t)
    }
  }
  return [...out]
}

/**
 * ブラウザ用の expand(token) を組み立てる。同じ実装を第2引数に SYN を
 * 束ねた形で呼び出すだけの薄い包み。
 */
export function browserExpandSource() {
  return `function expand(token) { return (${expand.toString()})(token, SYN) }`
}
```

- [ ] **Step 4: テストを走らせる**

```bash
node --test tools/search.test.mjs
```

期待: 4件すべて PASS。1件目は71キーすべてで v0.1 と一致することを確かめている。

- [ ] **Step 5: コミット**

```bash
git add tools/search.mjs tools/search.test.mjs
git commit -m "$(cat <<'EOF'
同義語の展開処理を1箇所にまとめる

madoguchi.html の expand() と、validate から呼ぶ検査用の展開が二重実装に
なるのを避けるため、実体を tools/search.mjs に置いた。ブラウザ用は
Function.prototype.toString() で書き出すので、コピーは存在しない。

v0.1 の辞書71キーすべてで展開結果が一致することをテストで確かめている。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 生成器

`data/` から HTML のデータ節と CSV を書き出す。CSV は現行3本とバイト一致させる。

**Files:**
- Create: `tools/build.mjs`
- Create: `tools/build.test.mjs`

**Interfaces:**
- Consumes: `view-model.mjs`（Task 4）、`search.mjs`（Task 5）、`yaml.mjs`（Task 2）
- Produces:
  - `replaceGenerated(html, body) -> string`（マーカー間を差し替え）
  - `toCsv(rows, columns) -> string`（BOM付き・LF・末尾改行）
  - `renderBlock(entries) -> string`（`[[名前, 値]]` を `const 名前 = 値` の並びに。値が文字列ならそのまま埋める）
  - `build(root) -> string[]`（書き換えたファイルのパス一覧）

- [ ] **Step 1: 失敗するテストを書く**

`tools/build.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { replaceGenerated, toCsv, renderBlock, BEGIN, END } from './build.mjs'

test('replaceGenerated はマーカー間だけを差し替える', () => {
  const html = `<script>\n${BEGIN}\nconst A = 1\n${END}\nconst keep = 2\n</script>`
  const out = replaceGenerated(html, 'const A = 9')
  assert.match(out, /const A = 9/)
  assert.match(out, /const keep = 2/)
  assert.doesNotMatch(out, /const A = 1/)
})

test('replaceGenerated はマーカーが無ければ落ちる', () => {
  assert.throws(() => replaceGenerated('<script>const A = 1</script>', 'x'), /マーカー/)
})

test('replaceGenerated は繰り返しても同じ結果になる', () => {
  const html = `<script>\n${BEGIN}\nconst A = 1\n${END}\n</script>`
  const once = replaceGenerated(html, 'const A = 9')
  assert.equal(replaceGenerated(once, 'const A = 9'), once)
})

test('toCsv は BOM 付き・LF・末尾改行で書く', () => {
  const csv = toCsv([{ a: '1', b: 'x' }], ['a', 'b'])
  assert.equal(csv, '﻿a,b\n1,x\n')
})

test('toCsv は欠けたキーを空文字にする', () => {
  assert.equal(toCsv([{ a: '1' }], ['a', 'b']), '﻿a,b\n1,\n')
})

test('toCsv は null を空文字にする', () => {
  assert.equal(toCsv([{ a: null, b: 'x' }], ['a', 'b']), '﻿a,b\n,x\n')
})

test('toCsv はカンマや引用符を含む値だけ引用する', () => {
  assert.equal(toCsv([{ a: 'x,y', b: 'z"w' }], ['a', 'b']), '﻿a,b\n"x,y","z""w"\n')
})

test('renderBlock は文字列の値をそのまま埋める', () => {
  const out = renderBlock([['A', [1, 2]], ['f', 'function f() {}']])
  assert.match(out, /const A = \[\n {2}1,\n {2}2\n\]/)
  assert.match(out, /^function f\(\) \{\}$/m)
})
```

- [ ] **Step 2: 失敗を確認**

```bash
node --test tools/build.test.mjs
```

期待: `Cannot find module` で FAIL。

- [ ] **Step 3: 実装する**

`tools/build.mjs`:

```js
#!/usr/bin/env node
/**
 * data/ を唯一の正として、各ビューのデータ節と data/*.csv を生成する。
 *
 * ビューの描画ロジック・CSS には触れない。HTML の @generated マーカーで
 * 囲まれた区間だけを差し替える。CI（.github/workflows/build.yml）が
 * これを回したあと git diff --exit-code で生成漏れを検出する。
 *
 * 使い方: node tools/build.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseYaml } from './yaml.mjs'
import { buildBranches, buildUnits, buildAmendments, buildSources } from './view-model.mjs'
import { browserExpandSource } from './search.mjs'

export const BEGIN = '/* @generated:begin — tools/build.mjs が data/ から生成。直接編集しないこと */'
export const END = '/* @generated:end */'

/** マーカー間を差し替える。マーカーが無いのは移行漏れなので落とす */
export function replaceGenerated(html, body) {
  const from = html.indexOf(BEGIN)
  const to = html.indexOf(END)
  if (from < 0 || to < 0 || to < from) throw new Error('@generated マーカーが見つかりません')
  return html.slice(0, from + BEGIN.length) + '\n' + body + '\n' + html.slice(to)
}

/** [[名前, 値]] を const の並びにする。値が文字列ならコードとしてそのまま埋める */
export function renderBlock(entries) {
  return entries
    .map(([name, value]) => (typeof value === 'string' ? value : `const ${name} = ${JSON.stringify(value, null, 2)}`))
    .join('\n')
}

/** 現行3本と同じ体裁（BOM付き・LF・末尾改行）で CSV を書く */
export function toCsv(rows, columns) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))]
  return '﻿' + lines.join('\n') + '\n'
}

const CSV_COLUMNS = {
  'org_units.csv': ['id', 'name', 'level', 'parent_id', 'branch', 'legal_source', 'article', 'duty_count', 'note'],
  'duties.csv': ['id', 'unit_id', 'unit_name', 'seq', 'text', 'legal_source', 'article'],
  'amendments.csv': ['source', 'promulgated_on', 'enforced_on', 'recorded_on', 'number', 'kind'],
}

export function build(root) {
  const at = (p) => new URL(p, root)
  const read = (p) => readFileSync(at(p), 'utf8')
  const written = []
  const write = (p, text) => { writeFileSync(at(p), text); written.push(p) }

  const data = JSON.parse(read('data/iki-seido-org.json'))
  const syn = parseYaml(read('data/synonyms.yml')).synonyms
  const scenarios = parseYaml(read('data/scenarios.yml')).scenarios

  const SOURCES = buildSources()
  const BRANCHES = buildBranches(data.organization, data.duties)
  const UNITS = buildUnits(BRANCHES)
  const { JOREI, KISOKU, KYOIKU } = buildAmendments(data.amendments)

  const blocks = {
    'soshiki/index.html': [['SOURCES', SOURCES], ['BRANCHES', BRANCHES]],
    'madoguchi/index.html': [
      ['SOURCES', SOURCES], ['BRANCHES', BRANCHES], ['UNITS', UNITS],
      ['SYN', syn], ['SCENARIOS', scenarios], ['expand', browserExpandSource()],
    ],
    'ugoki/index.html': [['JOREI', JOREI], ['KISOKU', KISOKU], ['KYOIKU', KYOIKU]],
  }
  for (const [path, entries] of Object.entries(blocks)) {
    write(path, replaceGenerated(read(path), renderBlock(entries)))
  }

  const rows = { 'org_units.csv': data.organization, 'duties.csv': data.duties, 'amendments.csv': data.amendments }
  for (const [name, columns] of Object.entries(CSV_COLUMNS)) {
    write(`data/${name}`, toCsv(rows[name], columns))
  }

  return written
}

// --- CLI --------------------------------------------------------------------
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const written = build(new URL('../', import.meta.url))
  console.log(`${written.length} ファイルを生成しました`)
  for (const p of written) console.log(`- ${p}`)
}
```

- [ ] **Step 4: テストを走らせる**

```bash
node --test tools/build.test.mjs
```

期待: 8件すべて PASS。

- [ ] **Step 5: コミット**

```bash
git add tools/build.mjs tools/build.test.mjs
git commit -m "$(cat <<'EOF'
data/ からビューのデータ節と CSV を生成する仕組みを作る

HTML の @generated マーカーで囲まれた区間だけを差し替える。描画ロジックと
CSS には触れないので、既存モックの表示品質はそのまま残る。

CSV は現行3本と同じ体裁（BOM付き・LF・末尾改行）で書く。現行データには
カンマ・引用符・改行を含むフィールドが1件もないため引用は発生しないが、
将来値が変わったときのために RFC4180 の引用処理は入れてある。

マーカーが見つからないときは黙って素通りせず落とす。移行漏れを
生成漏れとして検出できなくなるため。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: URL のディレクトリ化と移行の照合

ここで実ファイルを動かす。設計文書 §9 の「今回の移行時にだけ確認するもの」を
すべて満たすことが完了条件。

**Files:**
- Modify: `soshiki.html` → `soshiki/index.html`
- Modify: `madoguchi.html` → `madoguchi/index.html`
- Modify: `ugoki.html` → `ugoki/index.html`
- Modify: `index.html:123,128,133`
- Create: `tools/migration.check.mjs`（照合用・このタスクの最後に削除する）

**Interfaces:**
- Consumes: `build.mjs`（Task 6）、`v0.1-views.json`（Task 1）
- Produces: 新しいURL構成のHTML3本

- [ ] **Step 1: ファイルを移動する**

```bash
git mv soshiki.html soshiki-tmp && mkdir soshiki && git mv soshiki-tmp soshiki/index.html
git mv madoguchi.html madoguchi-tmp && mkdir madoguchi && git mv madoguchi-tmp madoguchi/index.html
git mv ugoki.html ugoki-tmp && mkdir ugoki && git mv ugoki-tmp ugoki/index.html
```

- [ ] **Step 2: トップへのリンクを直す**

移動前は `href="index.html"` で、そのままだと自分自身を指す。

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs"
for (const p of ["soshiki/index.html", "madoguchi/index.html", "ugoki/index.html"]) {
  const before = readFileSync(p, "utf8")
  const after = before.replace(/href="index\.html"/g, "href=\"../\"")
  if (before === after) throw new Error(`${p}: 置換対象が見つかりません`)
  writeFileSync(p, after)
}
'
```

`index.html` の3リンクを直す:

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs"
let s = readFileSync("index.html", "utf8")
for (const n of ["soshiki", "madoguchi", "ugoki"]) {
  if (!s.includes(`href="${n}.html"`)) throw new Error(`${n}.html へのリンクが見つかりません`)
  s = s.replace(`href="${n}.html"`, `href="${n}/"`)
}
writeFileSync("index.html", s)
'
```

- [ ] **Step 3: データ節をマーカーで囲む**

各ファイルで、データ宣言の始まりの直前に `BEGIN` 行を、終わりの直後に `END` 行を入れる。
囲む範囲は次のとおり。行番号は移動前のもので、`<script>` タグ自体は含めない。

| ファイル | 囲む範囲 |
|---|---|
| `soshiki/index.html` | `const SOURCES = {` から `BRANCHES.push(B_KYOIKU)` まで |
| `madoguchi/index.html` | `const SOURCES = {` から `function expand(token) { … }` の閉じ括弧まで（`esc` は含めない） |
| `ugoki/index.html` | `const JOREI = [` から `const KYOIKU = [ … ]` まで（`const EVENTS` は含めない） |

マーカー行の文字列は `tools/build.mjs` の `BEGIN` / `END` と1文字も違ってはいけないので、
手で打たずに次で確認する:

```bash
node --input-type=module -e '
import { BEGIN, END } from "./tools/build.mjs"
console.log(BEGIN); console.log(END)
'
```

- [ ] **Step 4: 生成を走らせる**

```bash
node tools/build.mjs
```

期待: `6 ファイルを生成しました` と、HTML3本・CSV3本の一覧。

- [ ] **Step 5: 移行の照合スクリプトを書く**

`tools/migration.check.mjs`:

```js
/**
 * 移行時にだけ走らせる照合。生成後のHTMLから変数を評価し、移行前に凍結した
 * v0.1-views.json と一致するかを確かめる。恒久テストにはしない
 * （data/ の正当な更新まで失敗させてしまうため。設計文書 §4.4）。
 */
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import assert from 'node:assert/strict'

const views = JSON.parse(readFileSync(new URL('./__fixtures__/v0.1-views.json', import.meta.url), 'utf8'))
const TARGETS = [
  ['soshiki', ['SOURCES', 'BRANCHES']],
  ['madoguchi', ['SOURCES', 'BRANCHES', 'UNITS', 'SYN', 'SCENARIOS']],
  ['ugoki', ['JOREI', 'KISOKU', 'KYOIKU']],
]

for (const [name, vars] of TARGETS) {
  const html = readFileSync(new URL(`../${name}/index.html`, import.meta.url), 'utf8')
  const script = html.split('<script>')[1].split('</script>')[0]
  const head = script.slice(0, script.lastIndexOf('\n', script.indexOf('document.')))
  const ctx = {}
  runInNewContext(`${head}\n;globalThis.__out = {${vars.join(',')}}`, ctx)
  for (const v of vars) {
    assert.deepEqual(ctx.__out[v], views[name][v], `${name}.${v} が v0.1 と一致しません`)
  }
  if (name === 'madoguchi') {
    const ctx2 = {}
    runInNewContext(`${head}\n;globalThis.__e = Object.fromEntries(Object.keys(SYN).map(k => [k, expand(k)]))`, ctx2)
    assert.deepEqual(ctx2.__e, views.madoguchi.expand, 'expand() の結果が v0.1 と一致しません')
  }
  console.log(`OK ${name}: ${vars.join(', ')}${name === 'madoguchi' ? ', expand' : ''}`)
}
console.log('移行照合 すべて一致')
```

- [ ] **Step 6: 照合を走らせる**

```bash
node tools/migration.check.mjs
```

期待:

```
OK soshiki: SOURCES, BRANCHES
OK madoguchi: SOURCES, BRANCHES, UNITS, SYN, SCENARIOS, expand
OK ugoki: JOREI, KISOKU, KYOIKU
移行照合 すべて一致
```

- [ ] **Step 7: CSV がバイト一致することを確認**

```bash
git diff --stat -- data/org_units.csv data/duties.csv data/amendments.csv
```

期待: **出力なし**（変更なし＝移行前とバイト一致）。差分が出た場合は `toCsv` の
体裁か列順が違うので、`git diff` の中身を見て `CSV_COLUMNS` と突き合わせる。

- [ ] **Step 8: ブラウザで表示を確認**

```bash
open soshiki/index.html madoguchi/index.html ugoki/index.html index.html
```

見るところ ─ 組織図が4系統ぶん描かれ色分けされていること、根拠条文パネルが開くこと、
逆引き検索で「引っ越し」がヒットすること、シナリオのボタンが動くこと、
年表に57件が並ぶこと、各ページ左上の「← 壱岐市 規定集の見える化(トップ)」で
トップへ戻れること。

- [ ] **Step 9: 照合スクリプトを消す**

一度きりの確認なので残さない（残すと恒久テストと誤解され、`data/` の更新で
失敗するようになる）。

```bash
rm tools/migration.check.mjs
```

- [ ] **Step 10: コミット**

```bash
git add -A
git commit -m "$(cat <<'EOF'
ビューを data/ からの生成物にし、URL をディレクトリ方式にする

soshiki.html などを soshiki/index.html に移し、データ節を @generated
マーカーで囲んで tools/build.mjs の生成物にした。これで条文データの実体は
data/iki-seido-org.json だけになり、ROADMAP の設計原則(1)「単一のデータ源」
が実際の構造と一致する。

内部リンクは双方向に直した。各ビューの「トップへ」は href="index.html" の
ままだとディレクトリ化で自分自身を指すため href="../" に、index.html 側は
soshiki.html を soshiki/ にした。

移行の正しさは、生成後のHTMLから変数を評価して v0.1 の凍結値と照合して
確認した（SOURCES・BRANCHES・UNITS・SYN・SCENARIOS・JOREI・KISOKU・KYOIKU、
および expand() の71キーぶんの出力）。CSV3本は移行前とバイト一致。
照合スクリプトは一度きりの確認なので残していない ─ 恒久テストにすると
今後の訂正や欠損収録が失敗するため（設計文書 §4.4）。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 内部リンクの検査

Task 7 の「トップへ」リンクのような事故を機械的に止める。リンク切れはビルドも
テストも通ってしまい、目視以外に気づく手段がない。

**Files:**
- Create: `tools/linkmap.mjs`
- Create: `tools/linkmap.test.mjs`

**Interfaces:**
- Consumes: なし
- Produces: `collectLinks(html) -> string[]`、`resolveTarget(fromPath, href) -> string`、`checkLinks(root) -> [{from, href, target}]`（未解決のものだけ）

- [ ] **Step 1: 失敗するテストを書く**

`tools/linkmap.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectLinks, resolveTarget, checkLinks } from './linkmap.mjs'

test('collectLinks は相対リンクだけを集める', () => {
  const html = `<a href="../">戻る</a><a href="https://example.com/x">外</a>
    <a href="data/README.md">読む</a><a href="#top">中</a><a href="mailto:a@example.com">×</a>`
  assert.deepEqual(collectLinks(html), ['../', 'data/README.md'])
})

test('resolveTarget はディレクトリ指定を index.html に解決する', () => {
  assert.equal(resolveTarget('soshiki/index.html', '../'), 'index.html')
  assert.equal(resolveTarget('index.html', 'soshiki/'), 'soshiki/index.html')
  assert.equal(resolveTarget('index.html', 'data/README.md'), 'data/README.md')
  assert.equal(resolveTarget('about/license/index.html', '../../'), 'index.html')
})

test('resolveTarget はクエリとフラグメントを落とす', () => {
  assert.equal(resolveTarget('index.html', 'soshiki/#tree'), 'soshiki/index.html')
})

test('リポジトリ内に未解決のリンクが無い', () => {
  assert.deepEqual(checkLinks(new URL('../', import.meta.url)), [])
})
```

- [ ] **Step 2: 失敗を確認**

```bash
node --test tools/linkmap.test.mjs
```

期待: `Cannot find module` で FAIL。

- [ ] **Step 3: 実装する**

`tools/linkmap.mjs`:

```js
#!/usr/bin/env node
/**
 * リポジトリ内のHTMLから相対リンクを集め、リンク先が実在するかを確かめる。
 *
 * ディレクトリ化に伴う相対パスのずれは、リンクが 404 になるだけでビルドも
 * テストも通ってしまう。目視以外に気づく手段がないので機械で止める。
 * 外部URL（http/https）は tools/linkcheck.mjs の担当なので見ない。
 *
 * 使い方: node tools/linkmap.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'docs'])

export function collectLinks(html) {
  const out = []
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1]
    if (/^(https?:|mailto:|tel:|#|\/\/)/.test(href)) continue
    out.push(href)
  }
  return out
}

export function resolveTarget(fromPath, href) {
  const clean = href.split('#')[0].split('?')[0]
  if (clean === '') return fromPath
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), clean))
  return clean.endsWith('/') || joined === '.' ? path.posix.join(joined === '.' ? '' : joined, 'index.html') : joined
}

function htmlFiles(root, dir = '') {
  const out = []
  for (const name of readdirSync(new URL(dir, root))) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue
    const rel = dir ? `${dir}${name}` : name
    if (statSync(new URL(rel, root)).isDirectory()) out.push(...htmlFiles(root, `${rel}/`))
    else if (name.endsWith('.html')) out.push(rel)
  }
  return out
}

export function checkLinks(root) {
  const broken = []
  for (const from of htmlFiles(root)) {
    const html = readFileSync(new URL(from, root), 'utf8')
    for (const href of collectLinks(html)) {
      const target = resolveTarget(from, href)
      if (!existsSync(new URL(target, root))) broken.push({ from, href, target })
    }
  }
  return broken
}

// --- CLI --------------------------------------------------------------------
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const broken = checkLinks(new URL('../', import.meta.url))
  if (broken.length === 0) {
    console.log('未解決の内部リンクはありません')
  } else {
    console.log(`## 未解決の内部リンク（${broken.length}件）`)
    for (const b of broken) console.log(`- ${b.from}: href="${b.href}" → ${b.target} が無い`)
    process.exit(1)
  }
}
```

- [ ] **Step 4: テストを走らせる**

```bash
node --test tools/linkmap.test.mjs
```

期待: 4件すべて PASS。4件目が落ちたら、そのリンクは Task 7 の直し漏れなので実ファイルを直す。

- [ ] **Step 5: CLI でも確認**

```bash
node tools/linkmap.mjs
```

期待: `未解決の内部リンクはありません`

- [ ] **Step 6: コミット**

```bash
git add tools/linkmap.mjs tools/linkmap.test.mjs
git commit -m "$(cat <<'EOF'
内部リンクの解決をテストで縛る

ディレクトリ化で相対パスがずれても、リンクが 404 になるだけでビルドも
テストも通ってしまう。今回の「トップへ」リンクがまさにそれで、目視でしか
気づけなかった。ページが増えるほど確認箇所が増えるので機械で止める。

ディレクトリ指定は index.html に解決する。外部URLは linkcheck.mjs の
担当なので見ない。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: データ検査

**Files:**
- Create: `tools/validate.mjs`
- Create: `tools/validate.test.mjs`
- Modify: `data/datapackage.json`（`resource.path` から `data/` を落とす）
- Modify: `data/iki-seido-org.json`（`quality_notes` の会計課の記述）

**Interfaces:**
- Consumes: `search.mjs`（Task 5）、`yaml.mjs`（Task 2）
- Produces: `validate({data, syn, scenarios, datapackage, fileExists}) -> [{severity, id, message}]`

- [ ] **Step 1: 失敗するテストを書く**

`tools/validate.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseYaml } from './yaml.mjs'
import { validate, EXPECTED_COUNTS } from './validate.mjs'

const at = (p) => new URL(`../${p}`, import.meta.url)
const load = () => ({
  data: JSON.parse(readFileSync(at('data/iki-seido-org.json'), 'utf8')),
  syn: parseYaml(readFileSync(at('data/synonyms.yml'), 'utf8')).synonyms,
  scenarios: parseYaml(readFileSync(at('data/scenarios.yml'), 'utf8')).scenarios,
  datapackage: JSON.parse(readFileSync(at('data/datapackage.json'), 'utf8')),
  fileExists: (p) => true,
})
const errors = (f) => f.filter((x) => x.severity === 'error')
const warns = (f) => f.filter((x) => x.severity === 'warn')

test('現行データは error 0 で通る', () => {
  assert.deepEqual(errors(validate(load())), [])
})

test('現行データの warn は同義語2語だけ', () => {
  const w = warns(validate(load()))
  assert.deepEqual(w.map((x) => x.id).sort(), ['長寿', '空き家'].sort())
})

test('件数の固定値は 96 / 597 / 57', () => {
  assert.deepEqual(EXPECTED_COUNTS, { organization: 96, duties: 597, amendments: 57 })
})

test('parent_id の参照切れを error にする', () => {
  const input = load()
  input.data.organization = input.data.organization.map((u) => (u.id === 'u002' ? { ...u, parent_id: 'u999' } : u))
  assert.ok(errors(validate(input)).some((f) => /u999/.test(f.message)))
})

test('duty_count と実件数の不一致を error にする', () => {
  const input = load()
  input.data.organization = input.data.organization.map((u) => (u.id === 'u001' ? { ...u, duty_count: 99 } : u))
  assert.ok(errors(validate(input)).some((f) => f.id === 'u001' && /duty_count/.test(f.message)))
})

test('未知の level を error にする', () => {
  const input = load()
  input.data.organization = input.data.organization.map((u) => (u.id === 'u001' ? { ...u, level: '局' } : u))
  assert.ok(errors(validate(input)).some((f) => f.id === 'u001' && /level/.test(f.message)))
})

test('todo: が付いた欠落は warn に落とす', () => {
  const input = load()
  input.data.organization = input.data.organization.map((u) => (u.id === 'u001' ? { ...u, article: 'todo: 条番号未確定' } : u))
  const f = validate(input)
  assert.equal(errors(f).filter((x) => x.id === 'u001').length, 0)
  assert.ok(warns(f).some((x) => x.id === 'u001' && /todo/.test(x.message)))
})

test('article が todo: なしで空なら error にする', () => {
  const input = load()
  input.data.organization = input.data.organization.map((u) => (u.id === 'u001' ? { ...u, article: '' } : u))
  assert.ok(errors(validate(input)).some((x) => x.id === 'u001'))
})

test('どの展開先も条文に当たらない同義語項目を error にする', () => {
  const input = load()
  input.syn = { ...input.syn, 'ホバークラフト': ['反重力', '浮遊装置'] }
  assert.ok(errors(validate(input)).some((f) => f.id === 'ホバークラフト'))
})

test('当たらない展開先が1語だけなら warn にとどめる', () => {
  const input = load()
  input.syn = { ...input.syn, 'ごみ袋': ['廃棄物', '反重力'] }
  const f = validate(input)
  assert.equal(errors(f).filter((x) => x.id === 'ごみ袋').length, 0)
  assert.ok(warns(f).some((x) => x.id === 'ごみ袋'))
})

test('どこにも当たらない検索語を含むシナリオを error にする', () => {
  const input = load()
  input.scenarios = [...input.scenarios, { label: '宇宙に行く', q: '反重力' }]
  assert.ok(errors(validate(input)).some((f) => f.id === '宇宙に行く'))
})

test('datapackage の path が実在しなければ error にする', () => {
  const input = load()
  input.fileExists = (p) => p !== 'org_units.csv'
  assert.ok(errors(validate(input)).some((f) => /org_units\.csv/.test(f.message)))
})

test('datapackage のフィールド定義と CSV の列がずれたら error にする', () => {
  const input = load()
  input.datapackage.resources[0].schema.fields.push({ name: 'bogus', type: 'string' })
  assert.ok(errors(validate(input)).some((f) => /bogus/.test(f.message)))
})

test('件数が固定値から動いたら error にする', () => {
  const input = load()
  input.data.organization = input.data.organization.slice(1)
  assert.ok(errors(validate(input)).some((f) => /organization/.test(f.message)))
})
```

- [ ] **Step 2: 失敗を確認**

```bash
node --test tools/validate.test.mjs
```

期待: `Cannot find module` で FAIL。

- [ ] **Step 3: datapackage.json のパスを直す**

descriptor は `data/` の中にあるので、`path` は `data/` を含んではいけない
（Data Resource 仕様では descriptor からの相対解決）。

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs"
const p = "data/datapackage.json"
const d = JSON.parse(readFileSync(p, "utf8"))
for (const r of d.resources) {
  if (!r.path.startsWith("data/")) throw new Error(`想定外の path: ${r.path}`)
  r.path = r.path.slice("data/".length)
}
writeFileSync(p, JSON.stringify(d, null, 2) + "\n")
'
node -e 'require("./data/datapackage.json").resources.forEach(r => console.log(r.name, r.path))'
```

期待:

```
org_units org_units.csv
duties duties.csv
amendments amendments.csv
full_dataset iki-seido-org.json
```

- [ ] **Step 4: quality_notes を直す**

会計課は「概要のみ」ではなく分掌事務が未収録（`duty_count` が 0）。利用者にとって
意味が違うので書き分ける。

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs"
const p = "data/iki-seido-org.json"
const d = JSON.parse(readFileSync(p, "utf8"))
const i = d.quality_notes.findIndex((n) => n.includes("会計課"))
if (i < 0) throw new Error("会計課に触れた quality_notes が見つかりません")
d.quality_notes[i] = "支所配下の班(市民生活班・地域班)と事務所(8か所)の分掌事務は概要のみ収録している(原文は支所だけで約69号を列挙)。該当は u078・u080・u081・u083・u084・u086・u087・u089。"
d.quality_notes.splice(i + 1, 0, "会計課(u075)・会計係(u076)の分掌事務は未収録(duty_count が 0)。概要すら入っていないため、存在しないのではなく未着手であることに注意。")
writeFileSync(p, JSON.stringify(d, null, 2) + "\n")
'
node -e 'require("./data/iki-seido-org.json").quality_notes.forEach((n,i) => console.log(i+1, n))'
```

- [ ] **Step 5: 実装する**

`tools/validate.mjs`:

```js
#!/usr/bin/env node
/**
 * data/ の整合性を検査する。
 *
 * error … 整合性の破れ、または必須項目が todo: なしで欠落
 * warn  … 必須項目の欠落に todo: がある（明示的な猶予）、または意味を壊さない不足
 *
 * 判定の根拠は docs/superpowers/specs/2026-08-13-repo-setup-design.md の §5。
 *
 * 使い方:
 *   node tools/validate.mjs
 *   node tools/validate.mjs --json
 *   node tools/validate.mjs --fail-on-error
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseYaml } from './yaml.mjs'
import { expand } from './search.mjs'

export const ENUM = {
  level: ['部', '課', '班', '室', '出先機関'],
  legal_source: ['jorei', 'kisoku', 'kyoiku'],
  branch: ['市長部局 ─ 本庁(6部)', '会計管理者の補助組織', '出先機関(市長部局)', '教育委員会事務局(市長部局とは別系統)'],
  kind: ['制定', '改正', '附則未掲載'],
}

/**
 * v0.2 でパーサに載せ替えるまでの、データ差し替え事故の安全装置。
 * 欠損収録のときは意図的に更新する（設計文書 §10）。
 */
export const EXPECTED_COUNTS = { organization: 96, duties: 597, amendments: 57 }

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const isTodo = (v) => typeof v === 'string' && v.startsWith('todo:')

const validDate = (s) => {
  if (!ISO_DATE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function validate({ data, syn, scenarios, datapackage, fileExists = (p) => existsSync(new URL(`../data/${p}`, import.meta.url)) }) {
  const found = []
  const add = (severity, id, message) => found.push({ severity, id, message })
  const units = data.organization ?? []
  const duties = data.duties ?? []
  const amendments = data.amendments ?? []

  // --- 件数 ---
  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = (data[key] ?? []).length
    if (actual !== expected) {
      add('error', '(件数)', `${key} が ${expected} 件から ${actual} 件に変化しています。意図した更新なら EXPECTED_COUNTS を直してください`)
    }
  }

  // --- 組織ユニット ---
  const byId = new Map()
  for (const u of units) {
    if (!u.id) { add('error', '(id なし)', 'id がありません'); continue }
    if (byId.has(u.id)) add('error', u.id, 'id が重複しています')
    else byId.set(u.id, u)
    if (!/^u\d{3}$/.test(u.id)) add('error', u.id, 'id は u000 形式です')
    for (const [field, allowed] of [['level', ENUM.level], ['legal_source', ENUM.legal_source], ['branch', ENUM.branch]]) {
      if (!allowed.includes(u[field])) add('error', u.id, `${field} が値域外です: ${u[field]}`)
    }
    if (!u.article) add(isTodo(u.article) ? 'warn' : 'error', u.id, 'article がありません')
    else if (isTodo(u.article)) add('warn', u.id, `article が未確定です（${u.article}）`)
  }
  for (const u of units) {
    if (!u.parent_id) continue
    if (!byId.has(u.parent_id)) add('error', u.id, `parent_id の参照先がありません: ${u.parent_id}`)
  }
  for (const u of units) {
    const seen = new Set([u.id])
    let cur = u.parent_id
    while (cur) {
      if (seen.has(cur)) { add('error', u.id, `parent_id が循環しています: ${cur}`); break }
      seen.add(cur)
      cur = byId.get(cur)?.parent_id
    }
  }

  // --- 分掌事務 ---
  const dutiesOf = new Map()
  const dutyIds = new Set()
  for (const d of duties) {
    if (!/^d\d{4}$/.test(d.id)) add('error', d.id, 'id は d0000 形式です')
    if (dutyIds.has(d.id)) add('error', d.id, 'id が重複しています')
    dutyIds.add(d.id)
    if (!byId.has(d.unit_id)) add('error', d.id, `unit_id の参照先がありません: ${d.unit_id}`)
    dutiesOf.set(d.unit_id, (dutiesOf.get(d.unit_id) ?? 0) + 1)
  }
  for (const u of units) {
    const actual = dutiesOf.get(u.id) ?? 0
    if (u.duty_count !== actual) add('error', u.id, `duty_count が ${u.duty_count} ですが実件数は ${actual} 件です`)
  }

  // --- 沿革 ---
  for (const a of amendments) {
    const label = `${a.source} ${a.number}`
    if (!ENUM.kind.includes(a.kind)) add('error', label, `kind が値域外です: ${a.kind}`)
    for (const f of ['promulgated_on', 'enforced_on', 'recorded_on']) {
      if (a[f] && !validDate(a[f])) add('error', label, `${f} が日付として不正です: ${a[f]}`)
    }
  }

  // --- Data Package ---
  const csvColumns = {
    'org_units.csv': ['id', 'name', 'level', 'parent_id', 'branch', 'legal_source', 'article', 'duty_count', 'note'],
    'duties.csv': ['id', 'unit_id', 'unit_name', 'seq', 'text', 'legal_source', 'article'],
    'amendments.csv': ['source', 'promulgated_on', 'enforced_on', 'recorded_on', 'number', 'kind'],
  }
  for (const r of datapackage.resources ?? []) {
    if (r.path.includes('/')) add('error', r.name, `path は descriptor からの相対パスです。ディレクトリを含められません: ${r.path}`)
    else if (!fileExists(r.path)) add('error', r.name, `path の実体がありません: ${r.path}`)
    const expected = csvColumns[r.path]
    if (!expected) continue
    const actual = (r.schema?.fields ?? []).map((f) => f.name)
    if (actual.join(',') !== expected.join(',')) {
      add('error', r.name, `フィールド定義が CSV の列と一致しません: [${actual}] ≠ [${expected}]`)
    }
  }

  // --- 同義語辞書 ---
  const corpus = duties.map((d) => d.text).join('\n')
  for (const [key, targets] of Object.entries(syn)) {
    const hit = targets.filter((t) => corpus.includes(t))
    if (hit.length === 0) add('error', key, `展開先のどの語も条文に現れません: ${targets.join('・')}`)
    else {
      const miss = targets.filter((t) => !corpus.includes(t))
      if (miss.length) add('warn', key, `条文に現れない展開先があります: ${miss.join('・')}`)
    }
  }

  // --- シナリオ ---
  for (const s of scenarios) {
    for (const word of s.q.split(/\s+/).filter(Boolean)) {
      if (!expand(word, syn).some((t) => corpus.includes(t))) {
        add('error', s.label, `検索語がどの分掌事務にも当たりません: ${word}`)
      }
    }
  }

  // --- 品質注記 ---
  if (!(data.quality_notes ?? []).length) add('warn', '(データセット)', 'quality_notes が空です')

  return found
}

// --- CLI --------------------------------------------------------------------
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const at = (p) => new URL(`../${p}`, import.meta.url)
  const findings = validate({
    data: JSON.parse(readFileSync(at('data/iki-seido-org.json'), 'utf8')),
    syn: parseYaml(readFileSync(at('data/synonyms.yml'), 'utf8')).synonyms,
    scenarios: parseYaml(readFileSync(at('data/scenarios.yml'), 'utf8')).scenarios,
    datapackage: JSON.parse(readFileSync(at('data/datapackage.json'), 'utf8')),
  })
  const errors = findings.filter((f) => f.severity === 'error')
  const warns = findings.filter((f) => f.severity === 'warn')

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ errors: errors.length, warns: warns.length, findings }, null, 2))
  } else {
    console.log(`## error（${errors.length}件）`)
    for (const f of errors) console.log(`- ${f.id}: ${f.message}`)
    console.log(`\n## warn（${warns.length}件）`)
    for (const f of warns) console.log(`- ${f.id}: ${f.message}`)
  }
  if (process.argv.includes('--fail-on-error') && errors.length > 0) process.exit(1)
}
```

- [ ] **Step 6: テストを走らせる**

```bash
node --test tools/validate.test.mjs
```

期待: 15件すべて PASS。

- [ ] **Step 7: CLI でも確認**

```bash
node tools/validate.mjs
```

期待: error 0件、warn 2件（`空き家` と `長寿`）。

- [ ] **Step 8: コミット**

```bash
git add tools/validate.mjs tools/validate.test.mjs data/datapackage.json data/iki-seido-org.json
git commit -m "$(cat <<'EOF'
データ検査を入れ、Data Package のパスと品質注記を直す

検査は iki-keikaku の error/warn 二段構えと todo: 規約を踏襲した。
未確定は todo: を明記すれば warn で通り、宿題としては見え続ける。

同時にデータ側の誤りを2件直した。

- datapackage.json の resource.path が data/org_units.csv 等になっていた。
  descriptor 自身が data/ にあるため、Data Resource 仕様の相対解決では
  data/data/org_units.csv を指し、公開しても読み込めない状態だった。
  path から data/ を落とし、全リソースの実在性を検査に加えた
- quality_notes が支所・事務所・会計課をまとめて「概要のみ」としていたが、
  会計課(u075)・会計係(u076) は duty_count が 0 で未収録だった。概要は
  読めるが不正確、未収録は存在に気づけないという違いがあるので書き分けた。
  概要にあたる8ユニットのIDも明記した

同義語辞書の検査は、部署参照ではなく条文テキストへの到達性を見る。SYN は
検索語→条文語の対応表で部署IDを持たないため参照検査ができない。項目単位で
1語も当たらなければ error、個別の語が当たらないだけなら warn とした。
現行データは error 0 / warn 2（空き家・長寿）で通る。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: 例規ページの死活確認

**Files:**
- Create: `tools/linkcheck.mjs`（`/Users/yet2come/Projects/iki-keikaku/tools/linkcheck.mjs` を土台に書き換え）

**Interfaces:**
- Consumes: `view-model.mjs` の `buildSources()`（Task 4）
- Produces: CLI のみ（`--json`、`--fail-on-dead`）

- [ ] **Step 1: 土台を読む**

```bash
cat /Users/yet2come/Projects/iki-keikaku/tools/linkcheck.mjs
```

引き継ぐ点 ─ UA を送らないと bot 対策で 403 を返すサーバがあること、404 だけでなく
「200 を返すが本文が空」も失効として扱うこと、タイムアウトと同時実行数の制限。

- [ ] **Step 2: iki-seido 版を書く**

`tools/linkcheck.mjs`:

```js
#!/usr/bin/env node
/**
 * 例規ページの死活を確認する。
 *
 * 例規集のCMSは移設・改称でURLが変わることがあり、気づかないまま古い根拠を
 * 指し続けるのが一番まずい（ROADMAP のリスク「例規ページの構造変更・アクセス制限」）。
 *
 * 見るのは到達性だけ。内容の変化＝改正の検知は iki-watch の担当で、ここで
 * 内容比較まで始めると二重になる。
 *
 * 使い方:
 *   node tools/linkcheck.mjs
 *   node tools/linkcheck.mjs --json
 *   node tools/linkcheck.mjs --fail-on-dead
 */
import { fileURLToPath } from 'node:url'
import { buildSources } from './view-model.mjs'

// UA を送らないと bot 対策で 403 を返すサーバがある（iki-keikaku で実際に踏んだ）
const UA = 'Mozilla/5.0 (compatible; iki-seido-linkcheck/1.0; +https://seido.ikilab.org)'
const TIMEOUT_MS = 20000
/** 相手は自治体のサーバ。ROADMAP のマナー方針に従い控えめに叩く */
const CONCURRENCY = 2

export async function check({ id, name, url }) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: ac.signal, redirect: 'follow' })
    const body = await res.text()
    // カテゴリ移設後の旧URLは 200 を返しつつ本文が空になることがある
    const dead = !res.ok || body.trim().length < 500
    return { id, name, url, status: res.status, bytes: body.length, dead }
  } catch (e) {
    return { id, name, url, status: null, bytes: 0, dead: true, error: e.message }
  } finally {
    clearTimeout(timer)
  }
}

export async function run() {
  const targets = Object.entries(buildSources()).map(([id, s]) => ({ id, name: s.name, url: s.url }))
  const results = []
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(targets.slice(i, i + CONCURRENCY).map(check))))
  }
  return results
}

// --- CLI --------------------------------------------------------------------
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const results = await run()
  const dead = results.filter((r) => r.dead)

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ checked: results.length, dead: dead.length, results }, null, 2))
  } else {
    for (const r of results) {
      console.log(`${r.dead ? 'DEAD' : 'OK  '} ${r.name} (${r.status ?? 'エラー'}, ${r.bytes} バイト)`)
      if (r.error) console.log(`     ${r.error}`)
    }
    console.log(`\n${results.length} 件中 ${dead.length} 件が失効`)
  }
  if (process.argv.includes('--fail-on-dead') && dead.length > 0) process.exit(1)
}
```

- [ ] **Step 3: 実際に叩いて確認**

```bash
node tools/linkcheck.mjs
```

期待: 3件すべて `OK`。ネットワークが無い環境では `DEAD` になるので、その場合は
`--json` で `error` の中身を見て、URL の誤りなのか到達不能なのかを切り分ける。

- [ ] **Step 4: コミット**

```bash
git add tools/linkcheck.mjs
git commit -m "$(cat <<'EOF'
例規ページの死活確認を入れる

例規集のCMSは移設・改称でURLが変わることがあり、気づかないまま古い根拠を
指し続けるのが一番まずい。iki-keikaku の実装を土台に、対象を例規3本に
絞って書き直した。

引き継いだ知見 ─ UA を送らないと bot 対策で 403 を返すサーバがあること、
カテゴリ移設後の旧URLが「200 を返すが本文が空」になること。同時実行数は
相手が自治体のサーバなので 2 に落とした。

見るのは到達性だけ。内容の変化＝改正の検知は iki-watch の担当で、ここで
内容比較を始めると二重になる。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: CI

**Files:**
- Create: `.github/workflows/build.yml`
- Create: `.github/workflows/linkcheck.yml`

**Interfaces:**
- Consumes: Task 6・8・9・10 のツール
- Produces: なし

- [ ] **Step 1: 生成漏れ検査のワークフローを書く**

`.github/workflows/build.yml`:

```yaml
name: 生成漏れとデータの検査

on:
  push:
    paths:
      - 'data/**'
      - 'tools/**'
      - 'index.html'          # ルート。*/index.html では一致しない
      - '*/index.html'        # soshiki/ madoguchi/ ugoki/
      - 'about/**/index.html'
      - '.github/workflows/build.yml'
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      # 依存のインストールはしない。ツールは外部依存なしで動く
      - name: 単体テスト
        run: node --test

      - name: データの検査
        run: node tools/validate.mjs --fail-on-error

      - name: 内部リンクの検査
        run: node tools/linkmap.mjs

      - name: 生成
        run: node tools/build.mjs

      - name: 生成漏れがないこと
        run: git diff --exit-code
```

- [ ] **Step 2: 死活確認のワークフローを書く**

`.github/workflows/linkcheck.yml`:

```yaml
name: 例規URLの死活チェック

on:
  schedule:
    - cron: '0 21 * * 0'   # 毎週月曜 6:00 JST（UTC 日曜 21:00）
  workflow_dispatch:
  push:
    paths:
      - 'tools/linkcheck.mjs'
      - '.github/workflows/linkcheck.yml'

permissions:
  contents: read
  issues: write

jobs:
  linkcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 死活の確認
        id: check
        run: |
          node tools/linkcheck.mjs | tee result.txt
          echo "dead=$(grep -c '^DEAD' result.txt || true)" >> "$GITHUB_OUTPUT"

      - name: 失効があれば Issue を立てる
        if: steps.check.outputs.dead != '0'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs')
            const body = [
              '例規ページの死活チェックで失効を検知しました。',
              '',
              '```',
              fs.readFileSync('result.txt', 'utf8'),
              '```',
              '',
              'URLの移設なら data/ の出典と tools/view-model.mjs の SOURCES を、',
              'ページ構造の変更なら scripts/parse_reiki.py の想定を確認してください。',
            ].join('\n')
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `例規ページの失効を検知（${new Date().toISOString().slice(0, 10)}）`,
              body,
              labels: ['linkcheck'],
            })
```

- [ ] **Step 3: 手元で同じ順序を通す**

```bash
node --test && node tools/validate.mjs --fail-on-error && node tools/linkmap.mjs && node tools/build.mjs && git diff --exit-code
```

期待: すべて成功し、最後の `git diff --exit-code` が無出力で終わる。
差分が出たら生成が決定的でないので、`build.mjs` のキー順・インデントを疑う。

- [ ] **Step 4: コミット**

```bash
git add .github/workflows
git commit -m "$(cat <<'EOF'
CI で生成漏れ・データ・内部リンク・例規URLを検査する

build.yml は node --test → validate → linkmap → build → git diff --exit-code
の順に回す。最後の一手が生成漏れの検出で、data/ だけ直して生成を忘れた
コミットを止める。

paths にルートの index.html を明示した。GitHub Actions の paths では
* が / に一致しないため、*/index.html だけではルートを拾わない。今回の
URL 変更の中心にあるファイルなので単独修正でCIが動かないのは危うい。
ワークフロー自身も含め、CIの変更がCIで検証されるようにした。

linkcheck.yml は週次で例規3本の到達性を見て、失効時に Issue を立てる。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: ライセンスと免責

**Files:**
- Create: `LICENSE`（iki-keikaku から複製）
- Create: `LICENSE-CODE`（同）
- Create: `NOTICE.md`
- Create: `DISCLAIMER.md`

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: 法文を複製する**

```bash
cp /Users/yet2come/Projects/iki-keikaku/LICENSE LICENSE
cp /Users/yet2come/Projects/iki-keikaku/LICENSE-CODE LICENSE-CODE
grep -n "Copyright\|20[0-9][0-9]" LICENSE-CODE | head -3
```

`LICENSE-CODE` の著作権表示が `© 2026 IKILAB` になっていることを確認する。
違っていれば直す。

- [ ] **Step 2: `NOTICE.md` を書く**

```markdown
# ライセンスの適用範囲

このリポジトリは、対象によって2つのライセンスを使い分けています。
**選んだ理由とクレジットの記載例は [`about/license/`](about/license/) を参照してください。**

| 対象 | ライセンス | ファイル |
|---|---|---|
| 文章・図表・データ | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja) | [`LICENSE`](LICENSE) |
| コード | [MIT](https://opensource.org/licenses/MIT) | [`LICENSE-CODE`](LICENSE-CODE) |

© 2026 IKILAB

## 条例・規則の本文はライセンスの対象外です

このリポジトリの中心にあるのは壱岐市の条例・規則の条文です。
**条例・規則の本文は著作権法第13条により権利の目的とならない**ため、
条文をそのまま転記した部分の二次利用は法的に自由で、クレジットも要りません。

CC BY 4.0 が及ぶのは、IKILAB が行った**構造化と編集**の部分です。

| 部分 | 扱い |
|---|---|
| 公式の条例・規則の本文をそのまま転記した記述 | 権利の目的とならない（自由に利用可） |
| ID体系（`u001` 等）・階層の起こし方・分類・系統の分け方 | CC BY 4.0 |
| 原文を要約した記述（下記の8ユニット） | CC BY 4.0 |
| `data/synonyms.yml`・`data/scenarios.yml` | CC BY 4.0（条文由来ではありません） |

### 要約にあたるレコード

原文の号を1件ずつ写したのではなく、IKILAB が要約した分掌事務です。

| ID | ユニット | 親 |
|---|---|---|
| u078 | 市民生活班 | 郷ノ浦支所 |
| u080 / u081 | 市民生活班 / 地域班 | 勝本支所 |
| u083 / u084 | 市民生活班 / 地域班 | 芦辺支所 |
| u086 / u087 | 市民生活班 / 地域班 | 石田支所 |
| u089 | 事務所(8か所) | ─ |

支所本体（u077・u079・u082・u085）は分掌事務を持ちません。
福祉事務所（u088）の「社会福祉法第14条第6項に規定する事務」は条文の転記であり、
要約ではありません。

## どのファイルがどちらか

**CC BY 4.0（文章・図表・データ）**

- `index.html`、`soshiki/index.html`、`madoguchi/index.html`、`ugoki/index.html`、
  `about/*/index.html` に含まれる**記述内容**のうち、条文の転記でない部分
- `data/` 以下のデータ（上表の区分に従う）
- `README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`DISCLAIMER.md`、`NOTICE.md`
- `docs/` 以下のドキュメント

**MIT（コード）**

- 上記HTMLファイルに含まれる**マークアップ・スタイル・スクリプト**
- `tools/` 以下のスクリプト
- `scripts/` 以下のスクリプト
- `.github/workflows/` 以下のワークフロー定義
- `.github/ISSUE_TEMPLATE/` 以下のテンプレート

同じHTMLファイルの中に複数が混在します。**「何が書いてあるか」が CC BY 4.0
（ただし条文の転記部分は対象外）、「どう表示しているか」が MIT** と考えてください。

## このライセンスが及ばないもの

### 壱岐市のウェブサイトそのもの

例規集のページ構成、デザイン、条文以外の説明文の著作権は壱岐市に帰属します。
このリポジトリは条文と沿革を構造化したものだけを収録しており、
ページの複製は行っていません。

壱岐市のウェブサイトには二次利用ルールの明示がないため
（[著作権・免責事項](https://www.city.iki.nagasaki.jp/3313.html)）、
出典のURLと取得日を記録し、条文の構造化にとどめています。

### 事実そのもの

課の数、班の構成、改正の日付といった事実は、そもそも著作物ではないため
ライセンスの対象外です。出典を確認したうえで自由にお使いください。

## クレジットの記載例

資料・スライドに組織図を使う場合:

```
出典：壱岐市 規定集の見える化（IKILAB）CC BY 4.0
https://seido.ikilab.org/soshiki/
```

内容を変えて使う場合は「改変して作成」の一言を足してください。
条文そのものを引用する場合は、クレジットは不要です（例規本文へのリンクを
添えていただけると読者が助かります）。
```

- [ ] **Step 3: `DISCLAIMER.md` を書く**

```markdown
# この資料について

## 性格

**壱岐市の公式資料ではありません。** 壱岐市が公表している例規集をもとに、
[IKILAB](https://ikilab.org) が独立して構造化したものです。市の見解を代弁する
ものではなく、市の承認・監修も受けていません。

**正式な内容は必ず[壱岐市例規集](https://www.city.iki.nagasaki.jp/section/reiki/)を
確認してください。**

## 内容の区分

各ページでは、記述を次の3つに分けています。

| 区分 | 意味 |
|---|---|
| 条文の転記 | 例規本文にそのまま書かれている文言 |
| 構造化の解釈 | 条文を読んで IKILAB が起こした階層・分類・ID |
| 未確認 | 原文にあたれていない、または内容が特定できていない箇所 |

## 基準日

**2026年8月11日**に例規ページを取得した時点の内容です。それ以降の改正は
反映されていません。

行政組織規則は制定以来38回改正されており（平均すると年1〜2回）、
**組織は毎年動きます。** 年度替わりの4月と、条例改正の施行日にあたる時期は
とくに注意してください。

## 未確認の箇所

v0.1 は例規HTMLからのLLM支援による半手動抽出で、次の限界があります。

1. **支所配下の班と事務所の分掌事務は概要のみ** ─ 原文は支所だけで約69号を
   列挙していますが、収録しているのは要約です。該当は u078・u080・u081・
   u083・u084・u086・u087・u089
2. **会計課（u075）・会計係（u076）の分掌事務は未収録** ─ 概要すら入っていません。
   分掌事務が存在しないのではなく、抽出が未着手です
3. **教育委員会規則の分掌事務の条番号が未確定** ─ 第2条（内部組織）のみ確認済み
4. **沿革の記載日は公布日と施行日が混在している可能性** ─ 規則・教委規則の
   `recorded_on` は例規ページの沿革表記に基づいており、基準が揃っていません
5. **令和8年3月19日条例第4号の内容が未確認** ─ 沿革に記載がありますが、
   本文ページに附則が見当たりません

1 と 2 は利用者にとって意味が違います。**概要は読めるが不正確、未収録は
存在に気づけない**という違いです。

## 誤りを見つけたら

[Issue](https://github.com/ikilab-org/iki-seido/issues) でお知らせください。
指摘は即座に修正します。

探したい窓口が見つからなかった場合も、そのまま教えてください。
市民の言葉と条文の言葉のギャップは、このプロジェクトが集めたい情報そのものです。
```

- [ ] **Step 4: 記述がデータと合っているか確かめる**

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs"
const d = JSON.parse(readFileSync("data/iki-seido-org.json", "utf8"))
const byId = Object.fromEntries(d.organization.map((u) => [u.id, u]))
const counts = Object.fromEntries(d.organization.map((u) => [u.id, u.duty_count]))
for (const id of ["u078","u080","u081","u083","u084","u086","u087","u089"]) {
  if (!byId[id] || counts[id] === 0) throw new Error(`${id} が要約対象として不正`)
}
for (const id of ["u075","u076"]) if (counts[id] !== 0) throw new Error(`${id} は未収録のはず`)
for (const id of ["u077","u079","u082","u085"]) if (counts[id] !== 0) throw new Error(`${id} は事務を持たないはず`)
if (counts["u088"] !== 1) throw new Error("u088 の事務は1件のはず")
const kisoku = d.amendments.filter((a) => a.source === "kisoku")
if (kisoku.filter((a) => a.kind === "改正").length !== 38) throw new Error("規則の改正は38件のはず")
console.log("NOTICE.md / DISCLAIMER.md の記述はデータと一致")
'
```

期待: `NOTICE.md / DISCLAIMER.md の記述はデータと一致`

- [ ] **Step 5: コミット**

```bash
git add LICENSE LICENSE-CODE NOTICE.md DISCLAIMER.md
git commit -m "$(cat <<'EOF'
ライセンスと免責を書く

ライセンス方針は iki-keikaku を踏襲（データ=CC BY 4.0 / コード=MIT）。
法文はそのまま複製し、適用範囲の説明は iki-seido 用に書き起こした。

iki-keikaku と違うのは、条文が主成分である点。条例・規則の本文は
著作権法13条により権利の目的とならないため、転記部分にはクレジットが
要らない。ただし「597件すべてが対象外」とは書いていない ─ 支所配下の班と
事務所の分掌事務は IKILAB の要約で、要約・選択・編集まで一律に13条の
対象外とは言い切れないため。該当する8ユニットをIDで名指しした。

DISCLAIMER の区分も iki-keikaku の「確認済み事実/推計/仮説」ではなく、
条文の転記に合う「条文の転記/構造化の解釈/未確認」にした。会計課は
「概要のみ」ではなく未収録なので、支所・事務所と項を分けて書いた。

記述がデータと食い違わないよう、ユニットIDと件数を実データで確認した。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: 説明文書とIssueテンプレート

**Files:**
- Create: `README.md`
- Create: `CHANGELOG.md`
- Create: `CONTRIBUTING.md`
- Create: `SETUP.md`
- Create: `about/license/index.html`
- Create: `.github/ISSUE_TEMPLATE/correction.md`
- Create: `.github/ISSUE_TEMPLATE/not-found.md`
- Modify: `data/README.md`（生成経路の説明）
- Modify: `scripts/build_dataset.js`（役割終了の注記）

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: `README.md` を書く**

構成は次の順。iki-keikaku の README を参考にしつつ、内容は iki-seido のもの。

```markdown
# 壱岐市 規定集の見える化

壱岐市の組織系3例規 ─ 行政組織条例・行政組織規則・教育委員会事務局組織規則 ─ の
条文を機械可読データに起こし、そこから3つの見え方を生成しています。

**https://seido.ikilab.org/**

| ビュー | 見えるもの |
|---|---|
| [組織図](https://seido.ikilab.org/soshiki/) | 部・課・班の階層と、それぞれの根拠条文 |
| [逆引き検索](https://seido.ikilab.org/madoguchi/) | 「引っ越し」から担当の班へ |
| [改正タイムライン](https://seido.ikilab.org/ugoki/) | 組織がいつどう動いてきたか |

**公式資料ではありません。** 正式な内容は
[壱岐市例規集](https://www.city.iki.nagasaki.jp/section/reiki/)を確認してください。
詳しくは [DISCLAIMER.md](DISCLAIMER.md) を参照。

## データ

| ファイル | 内容 | 件数 |
|---|---|---|
| [`data/iki-seido-org.json`](data/iki-seido-org.json) | 全データ（唯一の正） | ─ |
| [`data/org_units.csv`](data/org_units.csv) | 組織ユニット | 96 |
| [`data/duties.csv`](data/duties.csv) | 分掌事務（条文の号単位） | 597 |
| [`data/amendments.csv`](data/amendments.csv) | 改正沿革 | 57 |
| [`data/datapackage.json`](data/datapackage.json) | Frictionless Data 定義 | ─ |
| [`data/synonyms.yml`](data/synonyms.yml) | 同義語辞書（条文由来ではない） | 71 |
| [`data/scenarios.yml`](data/scenarios.yml) | ライフイベント（同上） | 8 |

CSV は JSON からの派生物です。直接編集せず、JSON を直して
`node tools/build.mjs` を回してください。

## 仕組み

```
                    ┌──────────────────────────┐
  parse_reiki.py ─→ │ data/iki-seido-org.json  │ ← 唯一の正
      (v0.2)        └────────────┬─────────────┘
                                 ▼
                      tools/view-model.mjs
                                 ▼
                      tools/build.mjs
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
            soshiki/index.html  ...      data/*.csv
```

ビューのデータ節は `@generated` マーカーで囲まれた生成物です。直接編集しても
次のビルドで上書きされます。

## 手元で動かす

外部依存はありません。Node.js 20 以上があれば動きます。

```bash
node --test                    # 単体テスト
node tools/validate.mjs        # データの検査
node tools/linkmap.mjs         # 内部リンクの検査
node tools/build.mjs           # 生成
node tools/linkcheck.mjs       # 例規ページの死活（ネットワークが要る）
```

## ツール

| ファイル | 役割 |
|---|---|
| `tools/build.mjs` | `data/` → ビューのデータ節・CSV |
| `tools/view-model.mjs` | フラットな組織データ → ビュー用の木構造 |
| `tools/search.mjs` | 同義語の展開（ブラウザ側の実体もここ） |
| `tools/validate.mjs` | データ検査 |
| `tools/linkmap.mjs` | 内部リンクの解決検査 |
| `tools/linkcheck.mjs` | 例規ページの死活確認 |
| `tools/yaml.mjs` | YAML読み取り（iki-keikaku から流用） |

## CI

| ワークフロー | 何を見るか |
|---|---|
| `.github/workflows/build.yml` | テスト・データ検査・内部リンク・生成漏れ |
| `.github/workflows/linkcheck.yml` | 例規3ページの到達性（週次） |

## ライセンス

条例・規則の本文は著作権法13条により権利の目的とならず、転記部分の二次利用は
自由です。IKILAB による構造化・要約の部分は CC BY 4.0、コードは MIT。
詳しくは [NOTICE.md](NOTICE.md)。

## 関連

- [壱岐市 計画マップ（iki-keikaku）](https://keikaku.ikilab.org/) ─ 行政計画の一覧
- [ROADMAP.md](ROADMAP.md) ─ このプロジェクトの計画
```

- [ ] **Step 2: `CHANGELOG.md` を書く**

```markdown
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
```

- [ ] **Step 3: `CONTRIBUTING.md` を書く**

必ず含める内容 ─ 誤りの指摘が最も歓迎されること、`data/` を直して
`node tools/build.mjs` を回す手順、生成物を直接編集しないこと、`todo:` 規約、
CI で回る検査の一覧、条文の転記と要約の区別。

```markdown
# 直し方・足し方

## いちばん歓迎する貢献

**誤りの指摘です。** このデータは例規HTMLからの半手動抽出で、
[DISCLAIMER.md](DISCLAIMER.md) に書いたとおり既知の限界があります。
条文と食い違う箇所を見つけたら、[Issue](https://github.com/ikilab-org/iki-seido/issues) で
教えてください。

**探した窓口が見つからなかった場合も教えてください。** 市民の言葉と条文の言葉の
ギャップは、このプロジェクトが集めたい情報そのものです。

## 直す場所

条文由来のデータはすべて `data/iki-seido-org.json` にあります。
**CSV とビューのHTMLは生成物なので直接編集しないでください。**
次のビルドで上書きされます。

```bash
# 1. data/iki-seido-org.json を直す
# 2. 検査して生成する
node --test
node tools/validate.mjs
node tools/build.mjs
# 3. 生成物を含めてコミットする
git add -A
```

`tools/build.mjs` を回し忘れると CI の `git diff --exit-code` で止まります。

## 未確定のときは `todo:`

原文にあたれていない項目は、空欄にせず `todo:` で始まる文字列を入れてください。

```json
{ "id": "u091", "article": "todo: 条番号未確定" }
```

検査は error ではなく warn で通します。空欄のまま放置すると error になり、
`todo:` を付けると「わかっていて残している」と記録されます。

## 検査の中身

| コマンド | 見るもの |
|---|---|
| `node --test` | 変換ロジックの回帰テスト |
| `node tools/validate.mjs` | 参照整合・値域・件数・同義語の到達性 |
| `node tools/linkmap.mjs` | 内部リンクの解決 |
| `node tools/linkcheck.mjs` | 例規ページの到達性（ネットワークが要る） |

`tools/__fixtures__/` は移行前に凍結したスナップショットです。**書き換えないでください。**
入力と期待値の両方が凍結された変換テストなので、`data/` を直しても影響しません。
ここを直したくなったときは、変換規則そのものを変えたということです。

## 条文の転記と要約を混ぜない

分掌事務には、条文をそのまま写した記述と IKILAB が要約した記述が混在しています
（[NOTICE.md](NOTICE.md) の表を参照）。要約されている箇所を原文に置き換える貢献は
とくに歓迎します。その際は `quality_notes` の該当行も一緒に直してください。
```

- [ ] **Step 4: `SETUP.md` を書く**

土台を読む:

```bash
grep -n '^#\+ ' /Users/yet2come/Projects/iki-keikaku/SETUP.md
```

iki-keikaku 固有の節（`plans.yml` の運用、OGP生成の playwright、分野別ページの
追加手順）は落とし、次の6節で構成する。各節に実際のコマンドを載せ、
「〜してください」だけの記述は残さない。

| 節 | 中身 |
|---|---|
| 前提 | Node.js 20 以上。外部依存なし。`gh` があると楽 |
| リポジトリを取得する | `git clone` と `node --test` で動作確認 |
| 手元で確認する | `node tools/build.mjs` → ブラウザで `index.html` を開く |
| GitHub Pages を有効にする | `gh api -X POST repos/ikilab-org/iki-seido/pages -f 'source[branch]=main' -f 'source[path]=/'`。画面から行う場合の場所も併記 |
| 独自ドメインをつなぐ | `CNAME` の中身が `seido.ikilab.org` であること。DNS に `seido` → `ikilab-org.github.io` の CNAME レコード。`dig +short seido.ikilab.org` で確認 |
| HTTPS を強制する | `gh api -X PUT repos/ikilab-org/iki-seido/pages -F https_enforced=true`。証明書の発行に数分かかること |

最後に、詰まりやすい点として次の3つを書く。**DNS の伝播に時間がかかること**、
**`.nojekyll` がないと `tools/__fixtures__` が配信されないこと**、
**`CNAME` を消すと独自ドメインの設定が外れること**。

- [ ] **Step 5: `about/license/index.html` を書く**

```bash
mkdir -p about/license
cp /Users/yet2come/Projects/iki-keikaku/about/license/index.html about/license/index.html
```

土台からの変更点は次のとおり。**マークアップと CSS は触らず、本文と
リンク先だけを差し替える。**

1. `<title>` と見出しを「ライセンスについて | 壱岐市 規定集の見える化」に
2. 本文を `NOTICE.md` と同じ4区分に置き換える（条文の転記＝権利の目的とならない /
   ID体系・階層・分類＝CC BY 4.0 / 要約8ユニット＝CC BY 4.0 /
   `synonyms.yml`・`scenarios.yml`＝CC BY 4.0）
3. iki-keikaku が CC0 を採らなかった理由（「解釈や推定を含む資料は出所が
   辿れなくなる」）は iki-seido にも当てはまるので残す。ただし主語を計画から
   例規の構造化に変える
4. クレジット記載例の URL を `https://seido.ikilab.org/soshiki/` に
5. トップへのリンクを `../../` に、`NOTICE.md` への参照を `../../NOTICE.md` に

リンクの正しさは Step 8 の `node tools/linkmap.mjs` で確かめる。手で数えない。

- [ ] **Step 6: Issue テンプレートを書く**

`.github/ISSUE_TEMPLATE/correction.md`:

```markdown
---
name: 誤りの指摘
about: 条文と食い違う記述を見つけた
title: '[訂正] '
labels: correction
---

## どのページ・どのデータ

<!-- URL か、data/ のファイル名とユニットID（u001 など） -->

## いまの記述

<!-- 表示されている内容をそのまま -->

## 正しい内容

<!-- わかる範囲で。条文のどこに書かれているかがあると助かります -->

## 根拠

<!-- 例規本文のURL・条番号など。「たぶん」でも構いません -->
```

`.github/ISSUE_TEMPLATE/not-found.md`:

```markdown
---
name: 探して見つからなかった
about: 逆引き検索で目的の窓口にたどり着けなかった
title: '[見つからない] '
labels: not-found
---

## 何を探していましたか

<!-- 例: 「農地を売りたい」「井戸を掘る許可」 -->

## 検索窓に入れた言葉

<!-- 実際に打った文字列をそのまま。これが一番の手がかりです -->

## たどり着きたかった課・班（わかれば）

<!-- わからなければ空欄で構いません -->

---

市民の言葉と条文の言葉のギャップは、このプロジェクトが集めたい情報そのものです。
「こんなの当たり前では」と思う言葉ほど、辞書に入っていないことがあります。
```

- [ ] **Step 7: `data/README.md` と `scripts/build_dataset.js` を更新する**

`data/README.md` の変更点 ─ 生成経路の表から `scripts/build_dataset.js` を外し
`tools/build.mjs` に差し替える、CSV が派生物である旨を書く、
`synonyms.yml` / `scenarios.yml` を表に足す、品質上の注意の会計課の記述を
`quality_notes` と揃える。

`scripts/build_dataset.js` の冒頭に注記を足す:

```js
/**
 * ⚠ このスクリプトは役割を終えています。
 *
 * v0.1 では、モックHTMLに埋め込まれた構造化データを読んで data/ を生成していました
 * （ビュー → データセット）。現在は向きが逆で、data/iki-seido-org.json が唯一の正、
 * ビューと CSV は tools/build.mjs の生成物です。
 *
 * 後継:
 *   - data/ から各ビューと CSV を生成する  … tools/build.mjs
 *   - 例規HTMLから data/ を生成する（v0.2） … scripts/parse_reiki.py
 *
 * v0.1 のデータがどう作られたかの記録として残しています。実行しないでください。
 */
```

- [ ] **Step 8: 検査を通す**

```bash
node --test && node tools/validate.mjs --fail-on-error && node tools/linkmap.mjs && node tools/build.mjs && git diff --exit-code
```

期待: すべて成功。`linkmap` は新しく増えた `about/license/index.html` からの
`../../` を含めて解決できること。

- [ ] **Step 9: コミット**

```bash
git add -A
git commit -m "$(cat <<'EOF'
説明文書とIssueテンプレートを書く

README・CHANGELOG・CONTRIBUTING・SETUP と about/license/ を整えた。
CONTRIBUTING には todo: 規約と「生成物を直接編集しない」ことを明記した ─
CSV とビューのデータ節は生成物で、直しても次のビルドで消えるため。

Issue テンプレートは iki-keikaku の new-plan.md にあたる枠を not-found.md
（探して見つからなかった言葉）に充てた。ROADMAP v0.3 がゼロヒットクエリの
収集を「市民の言葉と条文の言葉のギャップこそ最大の資産」と位置づけている
ので、受け皿を公開初日から置く。

scripts/build_dataset.js には役割終了の注記を入れた。データの流れが
反転した以上、これを現行の生成経路と取り違えると混乱する。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: 公開

**Files:**
- Create: `CNAME`
- Create: `.nojekyll`

**Interfaces:**
- Consumes: Task 1〜13 のすべて
- Produces: `https://seido.ikilab.org/`

- [ ] **Step 1: Pages 用のファイルを置く**

```bash
printf 'seido.ikilab.org\n' > CNAME
touch .nojekyll
```

`.nojekyll` は Jekyll の処理を止めるためのもの。アンダースコアで始まるディレクトリ
（`tools/__fixtures__` など）が無視されるのを防ぐ。

- [ ] **Step 2: 最終確認を通す**

```bash
node --test && node tools/validate.mjs --fail-on-error && node tools/linkmap.mjs && node tools/build.mjs && git diff --exit-code && echo "すべて通過"
```

期待: `すべて通過`

- [ ] **Step 3: コミット**

```bash
git add CNAME .nojekyll
git commit -m "$(cat <<'EOF'
GitHub Pages の設定ファイルを置く

CNAME は seido.ikilab.org。.nojekyll は Jekyll の処理を止めるためで、
これがないと tools/__fixtures__ のようなアンダースコア始まりの
ディレクトリが配信対象から外れる。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: リポジトリを作って push する**

**このステップは外向きの操作なので、実行前に利用者に確認する。**

```bash
gh repo create ikilab-org/iki-seido --public \
  --description "壱岐市の組織系例規を機械可読データにし、組織図・逆引き検索・改正タイムラインとして見せる" \
  --homepage "https://seido.ikilab.org" \
  --source . --remote origin --push
```

`gh` が使えない場合は、GitHub の画面で `ikilab-org/iki-seido` を公開で作ってから:

```bash
git remote add origin https://github.com/ikilab-org/iki-seido.git
git push -u origin main
```

- [ ] **Step 5: Pages を有効にする**

```bash
gh api -X POST repos/ikilab-org/iki-seido/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```

- [ ] **Step 6: DNS を設定してもらう**

**この手順は利用者が行う。** ドメイン管理画面で次のレコードを追加する:

| 種別 | ホスト | 値 |
|---|---|---|
| CNAME | `seido` | `ikilab-org.github.io` |

追加できたら次で確認する:

```bash
dig +short seido.ikilab.org
```

期待: `ikilab-org.github.io` を経由したIPが返る。

- [ ] **Step 7: HTTPS 強制と到達を確認**

DNS が伝播してから（数分〜1時間）:

```bash
gh api -X PUT repos/ikilab-org/iki-seido/pages -F https_enforced=true
for p in / /soshiki/ /madoguchi/ /ugoki/ /about/license/ /data/iki-seido-org.json; do
  printf '%s → %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://seido.ikilab.org$p")"
done
```

期待: すべて `200`。

- [ ] **Step 8: ROADMAP を更新する**

v0.2 の「GitHubリポジトリ公開」と v0.3 の「静的サイト公開」にチェックを入れ、
改訂履歴に1項足す。

```bash
git add ROADMAP.md
git commit -m "$(cat <<'EOF'
ROADMAP の公開関連の項目を完了にする

v0.2「GitHubリポジトリ公開」と v0.3「静的サイト公開」を消化した。
あわせて、当初 v0.2 の範囲になかったデータ源の反転（設計原則(1)の実装）を
今回済ませたことを改訂履歴に記録する。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## 完了条件

設計文書 §9 の全項目。

**恒久的に満たすもの**

- [ ] `node --test` が全て通る
- [ ] `node tools/validate.mjs` が error 0 で終わる（warn は `空き家`・`長寿` の2件）
- [ ] `node tools/linkmap.mjs` が未解決リンク 0 で終わる
- [ ] `node tools/build.mjs` の実行後に `git diff` が空
- [ ] `data/datapackage.json` の全リソースが descriptor からの相対パスで解決できる

**今回の移行時にだけ確認するもの**

- [ ] 生成した変数すべてが `v0.1-views.json` と完全一致（Task 7 Step 6）
- [ ] `data/*.csv` が移行前とバイト一致（Task 7 Step 7）
- [ ] 3ビューがブラウザで移行前と同じ描画・同じ検索結果（Task 7 Step 8）
- [ ] `index.html` から3ビューと `about/license/` へ、各ビューから `../` へ到達
- [ ] `https://seido.ikilab.org/` が3ビューを配信する（Task 14 Step 7）
