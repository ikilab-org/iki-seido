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

export const CSV_COLUMNS = {
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
