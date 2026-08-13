# 直し方・足し方

## いちばん歓迎する貢献

**誤りの指摘です。** このデータは例規HTMLからの半手動抽出で、
[DISCLAIMER.md](DISCLAIMER.md) に書いたとおり既知の限界があります。
条文と食い違う箇所を見つけたら、[Issue](https://github.com/ikilab-org/iki-seido/issues) で
教えてください。

**探した窓口が見つからなかった場合も教えてください。** 市民の言葉と条文の言葉の
ギャップは、このプロジェクトが集めたい情報そのものです。

## 直す場所

条文由来のデータはすべて `data/iki-seido-org.json` にあります。
**CSV とビューのHTMLは生成物なので直接編集しないでください。**
次のビルドで上書きされます。

```bash
# 1. data/iki-seido-org.json を直す
# 2. 検査して生成する
node --test
node tools/validate.mjs
node tools/linkmap.mjs
node tools/build.mjs
# 3. 生成物を含めてコミットする
git add -A
```

`tools/build.mjs` を回し忘れると CI の `git diff --exit-code` で止まります。

## 未確定のときは `todo:`

原文にあたれていない項目は、空欄にせず `todo:` で始まる文字列を入れてください。

```json
{ "id": "u091", "article": "todo: 条番号未確定" }
```

検査は error ではなく warn で通します。空欄のまま放置すると error になり、
`todo:` を付けると「わかっていて残している」と記録されます。

## 検査の中身

| コマンド | 見るもの |
|---|---|
| `node --test` | 変換ロジックの回帰テスト |
| `node tools/validate.mjs` | 参照整合・値域・件数・同義語の到達性 |
| `node tools/linkmap.mjs` | 内部リンクの解決 |
| `node tools/linkcheck.mjs` | 例規ページの到達性（ネットワークが要る） |

`tools/__fixtures__/` は移行前に凍結したスナップショットです。**書き換えないでください。**
入力と期待値の両方が凍結された変換テストなので、`data/` を直しても影響しません。
ここを直したくなったときは、変換規則そのものを変えたということです。

## 条文の転記と要約を混ぜない

分掌事務には、条文をそのまま写した記述と IKILAB が要約した記述が混在しています
（[NOTICE.md](NOTICE.md) の表を参照）。要約されている箇所を原文に置き換える貢献は
とくに歓迎します。その際は `quality_notes` の該当行も一緒に直してください。
