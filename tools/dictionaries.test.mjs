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
