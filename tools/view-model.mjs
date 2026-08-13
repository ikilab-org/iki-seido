/**
 * data/iki-seido-org.json のフラットな構造を、各ビューが描画に使う形へ変換する。
 *
 * HTML の中に置くとテストできないため独立させている。tools/build.mjs がこれを
 * 呼んで各ビューのデータ節を生成する。変換が正しいかどうかは、移行前に凍結した
 * tools/__fixtures__/ との照合で判定する（tools/view-model.test.mjs）。
 */

/** 教育委員会事務局の系統名。org_units の branch 列の値と完全一致する */
const KYOIKU_BRANCH = '教育委員会事務局(市長部局とは別系統)'

/** 例規3本の書誌。条文そのものではなく表示用の定数なのでここに置く */
const SOURCES = {
  jorei: {
    name: '壱岐市行政組織条例',
    url: 'https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000958.html',
    era: '平成23年条例第1号(令和7年6月1日施行)',
  },
  kisoku: {
    name: '壱岐市行政組織規則',
    url: 'https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html',
    era: '平成16年規則第2号(令和7年6月1日施行)',
  },
  kyoiku: {
    name: '壱岐市教育委員会事務局組織規則',
    url: 'https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000190.html',
    era: '平成16年教育委員会規則第5号(平成31年4月1日施行)',
  },
}

export function buildSources() {
  return structuredClone(SOURCES)
}

/**
 * level から表示用のクラスを決める。
 *
 * 逆変換は原理的に非可逆で、教委の課と市長部局の課はどちらも level:課 になる。
 * branch で見分ける。子の有無は使わない（level が 室 と 班 を既に分けているため）。
 */
export function clsOf(unit) {
  switch (unit.level) {
    case '部': return 'bu'
    case '課': return unit.branch === KYOIKU_BRANCH ? 'kyo' : 'ka'
    case '班': return unit.branch === KYOIKU_BRANCH ? 'kyo' : 'han'
    case '室': return 'han'
    case '出先機関': return 'etc'
    default: throw new Error(`未知の level: ${unit.level}`)
  }
}

/**
 * 系統ごとの木を組む。系統の並びは org_units の出現順に従う
 * （= 市長部局 → 会計 → 出先機関 → 教委）。
 */
export function buildBranches(units, duties) {
  const dutiesOf = new Map()
  for (const d of [...duties].sort((a, b) => a.seq - b.seq)) {
    if (!dutiesOf.has(d.unit_id)) dutiesOf.set(d.unit_id, [])
    dutiesOf.get(d.unit_id).push(d.text)
  }

  const childrenOf = new Map()
  for (const u of units) {
    if (!u.parent_id) continue
    if (!childrenOf.has(u.parent_id)) childrenOf.set(u.parent_id, [])
    childrenOf.get(u.parent_id).push(u)
  }

  const toNode = (u) => {
    const node = { n: u.name, cls: clsOf(u), legal: u.legal_source, art: u.article }
    if (u.note) node.note = u.note
    const kids = childrenOf.get(u.id)
    const cls = node.cls
    // duties は「子を持たないノード」と「部(bu)」に付く。部は条例が定める大分掌の
    // 事務を持ち、課・班の事務とは別の粒度で存在するため、子の有無に関わらず付く。
    // 課・室のように子(班)へ事務が分配されているノードには付かない。
    if ((!kids || !kids.length) || cls === 'bu') {
      node.duties = dutiesOf.get(u.id) || []
    }
    if (kids && kids.length) node.kids = kids.map(toNode)
    return node
  }

  const branches = []
  const byTitle = new Map()
  for (const u of units) {
    if (!byTitle.has(u.branch)) {
      const b = { title: u.branch, nodes: [] }
      byTitle.set(u.branch, b)
      branches.push(b)
    }
    if (!u.parent_id) byTitle.get(u.branch).nodes.push(toNode(u))
  }
  return branches
}

/**
 * 逆引き検索が舐めるフラットな一覧。分掌事務を持つノードだけを拾い、
 * 部は除く（部の事務は条例の大分掌で、課・班の事務と粒度が違うため）。
 */
export function buildUnits(branches) {
  const out = []
  const walk = (node, trail, branchTitle) => {
    if (node.duties && node.duties.length && node.cls !== 'bu') {
      out.push({
        name: node.n,
        path: trail.join(' › '),
        top: trail[0] || node.n,
        legal: node.legal,
        art: node.art || '',
        duties: node.duties,
        branch: branchTitle,
      })
    }
    for (const k of node.kids || []) walk(k, trail.concat(node.n), branchTitle)
  }
  for (const b of branches) for (const n of b.nodes) walk(n, [], b.title)
  return out
}

/**
 * 沿革をタプル配列にする。条例は公布日と施行日を持ち、規則・教委規則は
 * 沿革記載日のみを持つため、列の数が違う。
 */
export function buildAmendments(amendments) {
  const pick = (source) => amendments.filter((a) => a.source === source)
  const kindOf = (a) => (a.kind === '改正' ? null : a.kind)

  const jorei = pick('jorei').map((a) => [a.promulgated_on, a.enforced_on ?? null, a.number, kindOf(a)])
  const dated = (source) => pick(source).map((a) => {
    const row = [a.recorded_on, a.number]
    const k = kindOf(a)
    if (k !== null) row.push(k)
    return row
  })

  return { JOREI: jorei, KISOKU: dated('kisoku'), KYOIKU: dated('kyoiku') }
}
