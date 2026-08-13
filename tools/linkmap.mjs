#!/usr/bin/env node
/**
 * リポジトリ内のHTMLから相対リンクを集め、リンク先が実在するかを確かめる。
 *
 * ディレクトリ化に伴う相対パスのずれは、リンクが 404 になるだけでビルドも
 * テストも通ってしまう。目視以外に気づく手段がないので機械で止める。
 * 外部URL（http/https）は tools/linkcheck.mjs の担当なので見ない。
 *
 * <script> の中身は検査しない。ビューの描画コードが文字列連結で href を
 * 組み立てており（例: '<a href="' + s.url + '"'）、静的に見ると
 * 「' + s.url + '」のような実在しないリンクを拾ってしまうため。
 * 裏を返すと、JS が動的に作る内部リンクはこの検査の網にかからない。
 *
 * 使い方: node tools/linkmap.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'docs'])

export function collectLinks(html) {
  // 冒頭の注記のとおり、まず <script> を落としてから href を拾う
  const cleaned = html.replace(/<script[^>]*>.*?<\/script>/gis, '')
  const out = []
  for (const m of cleaned.matchAll(/href="([^"]+)"/g)) {
    const href = m[1]
    if (/^(https?:|mailto:|tel:|#|\/\/)/.test(href)) continue
    out.push(href)
  }
  return out
}

export function resolveTarget(fromPath, href) {
  const clean = href.split('#')[0].split('?')[0]
  if (clean === '') return fromPath
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), clean))
  return clean.endsWith('/') || joined === '.' ? path.posix.join(joined === '.' ? '' : joined, 'index.html') : joined
}

function htmlFiles(root, dir = '') {
  const out = []
  for (const name of readdirSync(new URL(dir, root))) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue
    const rel = dir ? `${dir}${name}` : name
    if (statSync(new URL(rel, root)).isDirectory()) out.push(...htmlFiles(root, `${rel}/`))
    else if (name.endsWith('.html')) out.push(rel)
  }
  return out
}

export function checkLinks(root) {
  const broken = []
  for (const from of htmlFiles(root)) {
    const html = readFileSync(new URL(from, root), 'utf8')
    for (const href of collectLinks(html)) {
      const target = resolveTarget(from, href)
      if (!existsSync(new URL(target, root))) broken.push({ from, href, target })
    }
  }
  return broken
}

// --- CLI --------------------------------------------------------------------
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const broken = checkLinks(new URL('../', import.meta.url))
  if (broken.length === 0) {
    console.log('未解決の内部リンクはありません')
  } else {
    console.log(`## 未解決の内部リンク（${broken.length}件）`)
    for (const b of broken) console.log(`- ${b.from}: href="${b.href}" → ${b.target} が無い`)
    process.exit(1)
  }
}
