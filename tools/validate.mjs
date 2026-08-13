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
import { CSV_COLUMNS } from './build.mjs'

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
  for (const r of datapackage.resources ?? []) {
    if (r.path.includes('/')) add('error', r.name, `path は descriptor からの相対パスです。ディレクトリを含められません: ${r.path}`)
    else if (!fileExists(r.path)) add('error', r.name, `path の実体がありません: ${r.path}`)
    const expected = CSV_COLUMNS[r.path]
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
