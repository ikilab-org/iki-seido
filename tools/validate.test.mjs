import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseYaml } from './yaml.mjs'
import { validate, EXPECTED_COUNTS, SUMMARY_UNIT_IDS } from './validate.mjs'
import { buildSources } from './view-model.mjs'

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

test('高齢者・空き家の展開先不足が warn として現れる', () => {
  // id は synonyms.yml の項目キーであって条文に当たらない展開先の語そのもの
  // ではない（テスト9・10が同じ前提: id === 'ホバークラフト' / id === 'ごみ袋'、
  // いずれも辞書キー）。「長寿」は "高齢者" 項目の展開先の1語であって、それ自体が
  // 項目キーとして synonyms.yml に存在するわけではない（実行結果で検証済み）。
  //
  // かつては warn 集合の完全一致（deepEqual）で検査していたが、それだと
  // data/synonyms.yml に新しい項目を1件足しただけで（辞書の追加はこのプロジェクトが
  // 最も歓迎する貢献）、その項目の展開先が1語でも条文に当たらなければ warn が
  // 1件増えて即座にテストが赤くなる。既知の2件が warn に含まれることだけを
  // 検査し、辞書の増加には寛容にする。
  const ids = warns(validate(load())).map((x) => x.id)
  assert.ok(ids.includes('高齢者'), '高齢者 が warn に含まれること')
  assert.ok(ids.includes('空き家'), '空き家 が warn に含まれること')
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

test('暦として存在しない日付を error にする', () => {
  const input = load()
  input.data.amendments = input.data.amendments.map((a, i) => (i === 0 ? { ...a, promulgated_on: '2026-02-30' } : a))
  assert.ok(errors(validate(input)).some((f) => /2026-02-30/.test(f.message)))
})

test('うるう年の2月29日は通す', () => {
  const input = load()
  input.data.amendments = input.data.amendments.map((a, i) => (i === 0 ? { ...a, promulgated_on: '2024-02-29' } : a))
  assert.deepEqual(errors(validate(input)), [])
})

test('未知の kind を error にする', () => {
  const input = load()
  input.data.amendments = input.data.amendments.map((a, i) => (i === 0 ? { ...a, kind: '廃止' } : a))
  assert.ok(errors(validate(input)).some((f) => /kind/.test(f.message)))
})

test('article が空欄なら todo: の有無によらず error にする', () => {
  const input = load()
  input.data.organization = input.data.organization.map((u) => (u.id === 'u001' ? { ...u, article: '' } : u))
  const f = validate(input)
  assert.ok(errors(f).some((x) => x.id === 'u001' && /article/.test(x.message)))
  assert.equal(warns(f).filter((x) => x.id === 'u001').length, 0)
})

test('amendments[].source の値域外を error にする', () => {
  // view-model.mjs の buildAmendments() は pick(source) で完全一致フィルタする
  // ため、source の typo（例: jorei → jourei）はその行を黙って結果から消す。
  // 件数（EXPECTED_COUNTS）は配列長を見るだけなので変化せず、検知できない。
  const input = load()
  input.data.amendments = input.data.amendments.map((a, i) => (i === 0 ? { ...a, source: 'jourei' } : a))
  assert.ok(errors(validate(input)).some((f) => /source/.test(f.message) && /jourei/.test(f.message)))
})

test('duties[].legal_source の値域外を error にする', () => {
  const input = load()
  input.data.duties = input.data.duties.map((d) => (d.id === 'd0001' ? { ...d, legal_source: 'jourei' } : d))
  assert.ok(errors(validate(input)).some((f) => f.id === 'd0001' && /legal_source/.test(f.message)))
})

test('要約8ユニットの一覧が SUMMARY_UNIT_IDS と一致する', () => {
  assert.deepEqual(errors(validate(load())), [])
  assert.deepEqual([...SUMMARY_UNIT_IDS].sort(), ['u078', 'u080', 'u081', 'u083', 'u084', 'u086', 'u087', 'u089'])
})

test('「概要」を含む分掌事務が増減すると要約ユニットの一覧が error になる', () => {
  const input = load()
  // u001（要約に含まれないユニット）の分掌事務に「概要」の語を紛れ込ませる
  input.data.duties = input.data.duties.map((d) => (d.id === 'd0001' ? { ...d, text: `${d.text}(概要)` } : d))
  assert.ok(errors(validate(input)).some((f) => f.id === '(要約ユニット)'))
})

test('data.sources が view-model.mjs の SOURCES と一致する', () => {
  assert.deepEqual(errors(validate(load())), [])
})

test('sources.name が view-model.mjs の SOURCES と食い違えば error にする', () => {
  const input = load()
  input.data.sources = input.data.sources.map((s) => (s.id === 'jorei' ? { ...s, name: '別の名前' } : s))
  assert.ok(errors(validate(input)).some((f) => f.id === 'jorei' && /sources\.name/.test(f.message)))
})

test('data.sources に無い id が view-model.mjs の SOURCES にあれば error にする', () => {
  const input = load()
  input.data.sources = input.data.sources.filter((s) => s.id !== 'kyoiku')
  assert.ok(errors(validate(input)).some((f) => f.id === 'kyoiku'))
})

test('sources は buildSources() の内容そのものを反映する', () => {
  const live = buildSources()
  const input = load()
  assert.deepEqual(new Set(input.data.sources.map((s) => s.id)), new Set(Object.keys(live)))
})
