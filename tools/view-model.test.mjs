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
