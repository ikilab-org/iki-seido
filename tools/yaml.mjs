// iki-keikaku（https://github.com/ikilab-org/iki-keikaku）から複製。
// 外部依存を増やさないための最小YAMLパーサで、両プロジェクトで同じ実装を使う。

/**
 * data/plans.yml が使う範囲だけを解釈する最小YAMLパーサ。
 *
 * 依存を増やさないために自前で持つ（.github/workflows は npm install をしない）。
 * 対応するのは次だけ。これ以外の構文が現れたら例外を投げる。
 *
 *   マップ / マップの配列 / スカラーの配列 / ネスト
 *   フロー形式  { start: 2024, end: 2026 }   [a, b]   []
 *   ブロックスカラー  >-  >  |  |-
 *   コメント（行頭、および引用符の外の " #" 以降）
 *   引用符つき文字列 'x' "x"
 *   null / true / false / 整数
 *
 * 日付めいた文字列（2026-08-12, 2024-03）は文字列のまま返す。
 * ブロックスカラーの中に空行や行頭 # を含む場合は想定していない。
 */

// --- 字句 -------------------------------------------------------------------

function tokenize(text) {
  return text.split(/\r?\n/).map((raw, i) => {
    const indent = raw.length - raw.replace(/^\s*/, '').length
    return { line: i + 1, indent, content: raw.slice(indent).replace(/\s+$/, '') }
  })
}

const isSkippable = (l) => l.content === '' || l.content.startsWith('#')

function skip(lines, i) {
  while (i < lines.length && isSkippable(lines[i])) i++
  return i
}

/** 引用符の外にある " #" 以降を落とす */
export function stripComment(s) {
  let quote = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === quote) quote = null
    } else if (c === "'" || c === '"') {
      quote = c
    } else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
      return s.slice(0, i).replace(/\s+$/, '')
    }
  }
  return s.replace(/\s+$/, '')
}

// --- スカラー ---------------------------------------------------------------

/** フロー形式の中身を、深さと引用符を見ながらカンマで割る */
function splitFlow(s) {
  const out = []
  let depth = 0, quote = null, cur = ''
  for (const c of s) {
    if (quote) {
      cur += c
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue }
    if (c === '{' || c === '[') depth++
    if (c === '}' || c === ']') depth--
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue }
    cur += c
  }
  if (cur.trim() !== '') out.push(cur)
  return out.map((x) => x.trim())
}

export function parseScalar(s) {
  const v = s.trim()
  if (v === '' || v === 'null' || v === '~') return null
  if (v === 'true') return true
  if (v === 'false') return false
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'")
  if (/^".*"$/.test(v)) return v.slice(1, -1)
  if (/^-?\d+$/.test(v)) return Number(v)
  return v
}

export function parseValue(s) {
  const v = s.trim()
  if (v.startsWith('[') && v.endsWith(']')) {
    return splitFlow(v.slice(1, -1)).map(parseValue)
  }
  if (v.startsWith('{') && v.endsWith('}')) {
    const obj = {}
    for (const part of splitFlow(v.slice(1, -1))) {
      const m = part.match(/^([^:]+):\s*(.*)$/)
      if (!m) throw new Error(`フロー形式のマップを解釈できません: ${part}`)
      obj[m[1].trim()] = parseValue(m[2])
    }
    return obj
  }
  return parseScalar(v)
}

// --- ブロックスカラー -------------------------------------------------------

function parseBlockScalar(lines, i, parentIndent, style) {
  const body = []
  while (i < lines.length) {
    const l = lines[i]
    if (l.content !== '' && l.indent <= parentIndent) break
    body.push(l.content)
    i++
  }
  while (body.length && body[body.length - 1] === '') body.pop()
  const folded = style.startsWith('>')
  // 折りたたみは行の連結だけを行い、行の中の空白には触れません。
  // ここで /\s+/ を潰すと、原文の全角スペース（U+3000）まで半角に変わり、
  // 引用が原文と違うものになります。行末の空白は tokenize で落としてあります。
  return [folded ? body.join(' ') : body.join('\n'), i]
}

// --- 構造 -------------------------------------------------------------------

const KEY = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:(?:\s+(.*))?$/

function parseNode(lines, i, indent) {
  const j = skip(lines, i)
  if (j >= lines.length) return [null, j]
  return lines[j].content.startsWith('- ') || lines[j].content === '-'
    ? parseSequence(lines, j, indent)
    : parseMapping(lines, j, indent)
}

function parseMapping(lines, i, indent) {
  const map = {}
  while (i < lines.length) {
    i = skip(lines, i)
    if (i >= lines.length) break
    const l = lines[i]
    if (l.indent < indent) break
    if (l.indent > indent) throw new Error(`${l.line}行目: 字下げが揃っていません`)
    if (l.content.startsWith('- ')) break

    const m = l.content.match(KEY)
    if (!m) throw new Error(`${l.line}行目: キーとして解釈できません: ${l.content}`)
    const key = m[1]
    const rest = stripComment(m[2] ?? '')

    if (/^[>|][-+]?$/.test(rest)) {
      const [v, n] = parseBlockScalar(lines, i + 1, indent, rest)
      map[key] = v
      i = n
    } else if (rest === '') {
      const j = skip(lines, i + 1)
      if (j < lines.length && lines[j].indent > indent) {
        const [v, n] = parseNode(lines, j, lines[j].indent)
        map[key] = v
        i = n
      } else {
        map[key] = null
        i = i + 1
      }
    } else {
      map[key] = parseValue(rest)
      i = i + 1
    }
  }
  return [map, i]
}

function parseSequence(lines, i, indent) {
  const arr = []
  while (i < lines.length) {
    i = skip(lines, i)
    if (i >= lines.length) break
    const l = lines[i]
    if (l.indent < indent) break
    if (l.indent > indent) throw new Error(`${l.line}行目: 字下げが揃っていません`)
    if (!l.content.startsWith('- ') && l.content !== '-') break

    const rest = l.content === '-' ? '' : l.content.slice(2)
    if (rest === '') {
      const j = skip(lines, i + 1)
      if (j < lines.length && lines[j].indent > indent) {
        const [v, n] = parseNode(lines, j, lines[j].indent)
        arr.push(v)
        i = n
      } else {
        arr.push(null)
        i = i + 1
      }
    } else if (KEY.test(rest)) {
      // "- id: x" は、字下げ indent+2 のマップの1行目とみなす
      const sub = [{ ...l, indent: indent + 2, content: rest }, ...lines.slice(i + 1)]
      const [v, n] = parseMapping(sub, 0, indent + 2)
      arr.push(v)
      i = i + n
    } else {
      arr.push(parseValue(stripComment(rest)))
      i = i + 1
    }
  }
  return [arr, i]
}

export function parseYaml(text) {
  const lines = tokenize(text)
  const i = skip(lines, 0)
  if (i >= lines.length) return {}
  const [value] = parseNode(lines, i, lines[i].indent)
  return value
}
