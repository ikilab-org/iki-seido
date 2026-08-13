import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseYaml, parseValue, parseScalar, stripComment } from './yaml.mjs'

test('スカラーを型に落とす', () => {
  assert.equal(parseScalar('null'), null)
  assert.equal(parseScalar(''), null)
  assert.equal(parseScalar('2018'), 2018)
  assert.equal(parseScalar('0'), 0)
  assert.equal(parseScalar('true'), true)
  assert.equal(parseScalar("'引用'"), '引用')
  assert.equal(parseScalar('"引用"'), '引用')
})

test('日付めいた文字列は文字列のまま', () => {
  assert.equal(parseScalar('2026-08-12'), '2026-08-12')
  assert.equal(parseScalar('2024-03'), '2024-03')
})

test('引用符の外のコメントだけ落とす', () => {
  assert.equal(stripComment('2018   # 令和元年 = 2019年'), '2018')
  assert.equal(stripComment('https://example.com/a#b'), 'https://example.com/a#b')
  assert.equal(stripComment('"# は文字列の中"'), '"# は文字列の中"')
})

test('フロー形式のマップと配列', () => {
  assert.deepEqual(parseValue('{ start: 2024, end: 2026 }'), { start: 2024, end: 2026 })
  assert.deepEqual(parseValue('{ start: null, end: null }'), { start: null, end: null })
  assert.deepEqual(parseValue('[a, b]'), ['a', 'b'])
  assert.deepEqual(parseValue('[]'), [])
})

test('マップの配列を読む', () => {
  const doc = parseYaml(['plans:', '  - id: a', '    name: あ', '  - id: b', '    name: い'].join('\n'))
  assert.deepEqual(doc.plans, [{ id: 'a', name: 'あ' }, { id: 'b', name: 'い' }])
})

test('スカラーの配列と空配列', () => {
  const doc = parseYaml(['laws:', '  - 社会福祉法107条', '  - 再犯防止推進法8条1項'].join('\n'))
  assert.deepEqual(doc.laws, ['社会福祉法107条', '再犯防止推進法8条1項'])
})

test('折りたたみブロックスカラーは1行に畳む', () => {
  const doc = parseYaml(['notes: >-', '  一行目。', '  二行目。', 'next: x'].join('\n'))
  assert.equal(doc.notes, '一行目。 二行目。')
  assert.equal(doc.next, 'x')
})

test('折りたたみは行の中の空白を変えない', () => {
  // /\s+/ で潰すと原文の全角スペース（U+3000）が半角になり、引用が原文と違うものになる
  const doc = parseYaml(['notes: >-', '  令和６年７月　策定', '  と表紙に明記。'].join('\n'))
  assert.equal(doc.notes, '令和６年７月　策定 と表紙に明記。')
  assert.equal(doc.notes.includes('　'), true, '全角スペースが失われています')
})

test('入れ子のマップ', () => {
  const doc = parseYaml(['successor:', '  name: 次期', '  public_comment: { start: 2026-12, end: 2027-01 }'].join('\n'))
  assert.deepEqual(doc.successor, { name: '次期', public_comment: { start: '2026-12', end: '2027-01' } })
})

test('行頭コメントと空行を飛ばす', () => {
  const doc = parseYaml(['# 見出し', '', 'meta:', '  # 中のコメント', '  era_base: 2018', ''].join('\n'))
  assert.deepEqual(doc.meta, { era_base: 2018 })
})

test('実際の data/plans.yml を読み切る', () => {
  const doc = parseYaml(readFileSync(new URL('../data/plans.yml', import.meta.url), 'utf8'))
  // 件数は計画を足すたびに増えるので、下限と「全件に id がある」ことで確かめる。
  // 固定値にすると、巡回で1件足すだけでテストが落ちる。
  assert.ok(doc.plans.length >= 31, `計画が31件未満です: ${doc.plans.length}`)
  assert.equal(doc.meta.era_base, 2018)
  assert.equal(doc.plans[0].id, 'sougou-4')
  assert.deepEqual(doc.plans.find((p) => p.id === 'bousai').period, { start: null, end: null })
  assert.equal(doc.plans.every((p) => typeof p.id === 'string'), true)
  const k9 = doc.plans.find((p) => p.id === 'kourei-9')
  assert.deepEqual(k9.predecessors, ['kourei-8', 'kourei-7'])
  assert.equal(k9.successor.public_comment.start, '2026-12')
  assert.equal(k9.sources[0].url.startsWith('https://'), true)
})
