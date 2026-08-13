import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseYaml } from './yaml.mjs'

// tools/__fixtures__/v0.1-views.json は移行前の凍結スナップショット
// （tools/__fixtures__/README.md 参照）。data/ の更新で影響を受けてはいけない
// 純粋な変換テストの入力・期待値であって、data/synonyms.yml・
// data/scenarios.yml が「今こうあるべきか」の基準ではない。
//
// かつてはこのファイルの2テストが live データと fixture の deepEqual を
// 取っていたため、data/synonyms.yml に新しい同義語を1件足す（このプロジェクトが
// 最も歓迎する貢献 ─ not-found.md の Issue テンプレートと ROADMAP v0.3の
// ゼロヒットクエリ収集の受け皿そのもの）だけで node --test が落ち、
// CONTRIBUTING.md が「直接編集しないでください」と明言している
// tools/__fixtures__/ に貢献者の目を向けてしまっていた。
//
// ここでは形（同義語辞書はキー→非空の文字列配列、シナリオは
// {label, q} の非空文字列)を検査し、v0.1 時点の項目が消えていないことだけ
// fixture と突き合わせる。追加は失敗させず、消失・改変だけ検知する。

const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/v0.1-views.json', import.meta.url), 'utf8'))
const read = (f) => parseYaml(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'))

test('synonyms.yml は 文字列キー → 空でない文字列配列 のマップである', () => {
  const syn = read('synonyms.yml').synonyms
  assert.ok(syn && typeof syn === 'object' && !Array.isArray(syn), 'synonyms がマップではありません')
  const keys = Object.keys(syn)
  assert.ok(keys.length > 0, 'synonyms が空です')
  for (const [key, targets] of Object.entries(syn)) {
    assert.equal(typeof key, 'string')
    assert.ok(key.length > 0, 'キーに空文字があります')
    assert.ok(Array.isArray(targets), `${key} の値が配列ではありません`)
    assert.ok(targets.length > 0, `${key} の展開先が空です`)
    for (const t of targets) {
      assert.equal(typeof t, 'string', `${key} の展開先に文字列でない値があります`)
      assert.ok(t.length > 0, `${key} に空文字の展開先があります`)
    }
  }
})

test('scenarios.yml は {label, q} の配列で、どちらも空でない文字列である', () => {
  const scenarios = read('scenarios.yml').scenarios
  assert.ok(Array.isArray(scenarios), 'scenarios が配列ではありません')
  assert.ok(scenarios.length > 0, 'scenarios が空です')
  for (const s of scenarios) {
    assert.equal(typeof s.label, 'string')
    assert.ok(s.label.length > 0, 'label が空のシナリオがあります')
    assert.equal(typeof s.q, 'string')
    assert.ok(s.q.length > 0, `${s.label} の q が空です`)
  }
})

test('synonyms.yml は v0.1 の全項目(展開先を含む)を保持している', () => {
  const syn = read('synonyms.yml').synonyms
  for (const [key, targets] of Object.entries(fixture.madoguchi.SYN)) {
    assert.ok(key in syn, `v0.1 にあった項目が消えています: ${key}`)
    for (const t of targets) {
      assert.ok(syn[key].includes(t), `v0.1 の展開先が消えています: ${key} → ${t}`)
    }
  }
})

test('scenarios.yml は v0.1 の全シナリオ(検索語を含む)を保持している', () => {
  const scenarios = read('scenarios.yml').scenarios
  for (const fs of fixture.madoguchi.SCENARIOS) {
    const live = scenarios.find((s) => s.label === fs.label)
    assert.ok(live, `v0.1 にあったシナリオが消えています: ${fs.label}`)
    const liveWords = new Set(live.q.split(/\s+/).filter(Boolean))
    for (const w of fs.q.split(/\s+/).filter(Boolean)) {
      assert.ok(liveWords.has(w), `v0.1 の検索語が消えています: ${fs.label} の「${w}」`)
    }
  }
})
