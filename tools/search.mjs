/**
 * 市民の言葉を条文の言葉へ広げる。
 *
 * 実体はこの1箇所だけに置く。ブラウザ側にも同じ処理が要るが、コピーを置くと
 * 必ずずれるので、tools/build.mjs が browserExpandSource() の出力を
 * madoguchi/index.html の生成区間へ書き出す。
 */

/**
 * 辞書に完全一致すればその展開先を、無ければ辞書のキーを部分一致で探して
 * 引っかかったものの展開先を足す。入力語そのものは常に残す。
 */
export function expand(token, syn) {
  const out = new Set([token])
  if (syn[token]) {
    for (const t of syn[token]) out.add(t)
  } else {
    for (const k of Object.keys(syn)) {
      if (token.indexOf(k) >= 0) for (const t of syn[k]) out.add(t)
    }
  }
  return [...out]
}

/**
 * ブラウザ用の expand(token) を組み立てる。同じ実装を第2引数に SYN を
 * 束ねた形で呼び出すだけの薄い包み。
 */
export function browserExpandSource() {
  return `function expand(token) { return (${expand.toString()})(token, SYN) }`
}
