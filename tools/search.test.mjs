import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import assertLoose from 'node:assert'
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
  // Cross-context arrays need loose comparison due to different Array constructors
  assertLoose.deepEqual(ctx.__r, expand('引っ越し', SYN))
})
