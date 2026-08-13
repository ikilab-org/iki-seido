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
