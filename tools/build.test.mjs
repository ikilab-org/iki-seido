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
