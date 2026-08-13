# 凍結スナップショット

v0.1（LLM支援の半手動抽出）の入力と出力を、生成方式へ移行する前に固定したもの。

| ファイル | 中身 |
|---|---|
| `v0.1-data.json` | 移行前の `data/iki-seido-org.json` |
| `v0.1-views.json` | 移行前の3ビューHTMLから評価した変数の値 |

**この2つは書き換えない。** `view-model.mjs` の変換テストは、入力と期待値の
両方をここから取る純粋な変換テストであり、`data/` が更新されても影響を受けない。
壊れるのは変換規則そのものを変えたときだけで、それは正しい。

`data/` の訂正・欠損収録・v0.2 のパーサ移行でこのファイルを更新する必要はない。
更新したくなったら、それは変換規則を変えたということなので、テストの期待値ではなく
テストの意図を先に見直すこと。

## 注記: soshiki.BRANCHES の抽出

`soshiki.html` には `prep()` というヘルパー関数が定義されており（362行目）、これは BRANCHES の各ノードに実行時に `id`・`parent` フィールドを注入する DOM 表示用のユーティリティである。この関数呼び出し（368行目）は `document.` の手前で発火するため、「最初の `document.` 直前まで評価」という標準的な抽出方式を使うと、この副作用が凍結されてしまう。`soshiki.BRANCHES` の純粋な宣言形 `{n, cls, legal, art, note?, duties?, kids?}` を得るため、ここだけ例外的に `function prep(node, parent)` の直前で評価を切り詰めている。madoguchi・ugoki 側の抽出にはこの種の問題がないので変更していない。

## Fix (round 2): madoguchi.UNITS の duties 欠落

初回抽出（aa0637f）時の `JSON.stringify` replacer は、`soshiki.html` の `prep()` が作る真の循環参照（parent ↔ kids）を避けるため、「已出オブジェクトを除外する」仕組みを持っていた。この判定がオブジェクト単位ではなく views 全体を通した「一度シリアライズされたら二度と載せない」という global な seen セット方式だったため、`madoguchi.html` では実害のない DAG 型の共有参照まで巻き添えにしていた。`madoguchi.UNITS` の各エントリは `walk()` で `duties: node.duties` として BRANCHES のツリー内に同じ配列オブジェクトを流用（コピーではない）するが、BRANCHES 側で一度シリアライズされたその配列が UNITS 側で再び現れたときに「既出」と誤判定されて丸ごと落ちていた。`madoguchi.html` 自体には循環参照がない（`prep()` 相当の副作用がない）ため、本来 replacer は不要だった。再抽出時に plain な `JSON.stringify`（replacer無し）を使用し、madoguchi.UNITS のみを復元した。
