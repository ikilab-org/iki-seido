#!/usr/bin/env node
/**
 * 例規ページの死活を確認する。
 *
 * 例規集のCMSは移設・改称でURLが変わることがあり、気づかないまま古い根拠を
 * 指し続けるのが一番まずい（ROADMAP のリスク「例規ページの構造変更・アクセス制限」）。
 *
 * 見るのは到達性だけ。内容の変化＝改正の検知は iki-watch の担当で、ここで
 * 内容比較まで始めると二重になる。
 *
 * 使い方:
 *   node tools/linkcheck.mjs
 *   node tools/linkcheck.mjs --json
 *   node tools/linkcheck.mjs --fail-on-dead
 */
import { fileURLToPath } from 'node:url'
import { buildSources } from './view-model.mjs'

// UA を送らないと bot 対策で 403 を返すサーバがある（iki-keikaku で実際に踏んだ）
const UA = 'Mozilla/5.0 (compatible; iki-seido-linkcheck/1.0; +https://seido.ikilab.org)'
const TIMEOUT_MS = 20000
/** 相手は自治体のサーバ。ROADMAP のマナー方針に従い控えめに叩く */
const CONCURRENCY = 2

export async function check({ id, name, url }) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: ac.signal, redirect: 'follow' })
    const body = await res.text()
    // カテゴリ移設後の旧URLは 200 を返しつつ本文が空になることがある
    const dead = !res.ok || body.trim().length < 500
    return { id, name, url, status: res.status, bytes: body.length, dead }
  } catch (e) {
    return { id, name, url, status: null, bytes: 0, dead: true, error: e.message }
  } finally {
    clearTimeout(timer)
  }
}

export async function run() {
  const targets = Object.entries(buildSources()).map(([id, s]) => ({ id, name: s.name, url: s.url }))
  const results = []
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(targets.slice(i, i + CONCURRENCY).map(check))))
  }
  return results
}

// --- CLI --------------------------------------------------------------------
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const results = await run()
  const dead = results.filter((r) => r.dead)

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ checked: results.length, dead: dead.length, results }, null, 2))
  } else {
    for (const r of results) {
      console.log(`${r.dead ? 'DEAD' : 'OK  '} ${r.name} (${r.status ?? 'エラー'}, ${r.bytes} バイト)`)
      if (r.error) console.log(`     ${r.error}`)
    }
    console.log(`\n${results.length} 件中 ${dead.length} 件が失効`)
  }
  if (process.argv.includes('--fail-on-dead') && dead.length > 0) process.exit(1)
}
