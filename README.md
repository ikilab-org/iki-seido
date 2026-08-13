# 壱岐市 規定集の見える化

壱岐市の組織系3例規 ─ 行政組織条例・行政組織規則・教育委員会事務局組織規則 ─ の
条文を機械可読データに起こし、そこから3つの見え方を生成しています。

**https://seido.ikilab.org/**

| ビュー | 見えるもの |
|---|---|
| [組織図](https://seido.ikilab.org/soshiki/) | 部・課・班の階層と、それぞれの根拠条文 |
| [逆引き検索](https://seido.ikilab.org/madoguchi/) | 「引っ越し」から担当の班へ |
| [改正タイムライン](https://seido.ikilab.org/ugoki/) | 組織がいつどう動いてきたか |

**公式資料ではありません。** 正式な内容は
[壱岐市例規集](https://www.city.iki.nagasaki.jp/section/reiki/)を確認してください。
詳しくは [DISCLAIMER.md](DISCLAIMER.md) を参照。

## データ

| ファイル | 内容 | 件数 |
|---|---|---|
| [`data/iki-seido-org.json`](data/iki-seido-org.json) | 全データ（唯一の正） | ─ |
| [`data/org_units.csv`](data/org_units.csv) | 組織ユニット | 96 |
| [`data/duties.csv`](data/duties.csv) | 分掌事務（条文の号単位） | 597 |
| [`data/amendments.csv`](data/amendments.csv) | 改正沿革 | 57 |
| [`data/datapackage.json`](data/datapackage.json) | Frictionless Data 定義 | ─ |
| [`data/synonyms.yml`](data/synonyms.yml) | 同義語辞書（条文由来ではない） | 71 |
| [`data/scenarios.yml`](data/scenarios.yml) | ライフイベント（同上） | 8 |

CSV は JSON からの派生物です。直接編集せず、JSON を直して
`node tools/build.mjs` を回してください。

## 仕組み

```
                    ┌──────────────────────────┐
  parse_reiki.py ─→ │ data/iki-seido-org.json  │ ← 唯一の正
      (v0.2)        └────────────┬─────────────┘
                                 ▼
                      tools/view-model.mjs
                                 ▼
                      tools/build.mjs
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
            soshiki/index.html  ...      data/*.csv
```

ビューのデータ節は `@generated` マーカーで囲まれた生成物です。直接編集しても
次のビルドで上書きされます。

## 手元で動かす

外部依存はありません。Node.js 20 以上があれば動きます。

```bash
node --test                    # 単体テスト
node tools/validate.mjs        # データの検査
node tools/linkmap.mjs         # 内部リンクの検査
node tools/build.mjs           # 生成
node tools/linkcheck.mjs       # 例規ページの死活（ネットワークが要る）
```

## ツール

| ファイル | 役割 |
|---|---|
| `tools/build.mjs` | `data/` → ビューのデータ節・CSV |
| `tools/view-model.mjs` | フラットな組織データ → ビュー用の木構造 |
| `tools/search.mjs` | 同義語の展開（ブラウザ側の実体もここ） |
| `tools/validate.mjs` | データ検査 |
| `tools/linkmap.mjs` | 内部リンクの解決検査 |
| `tools/linkcheck.mjs` | 例規ページの死活確認 |
| `tools/yaml.mjs` | YAML読み取り（iki-keikaku から流用） |

## CI

| ワークフロー | 何を見るか |
|---|---|
| `.github/workflows/build.yml` | テスト・データ検査・内部リンク・生成漏れ |
| `.github/workflows/linkcheck.yml` | 例規3ページの到達性（週次） |

## ライセンス

条例・規則の本文は著作権法13条により権利の目的とならず、転記部分の二次利用は
自由です。IKILAB による構造化・要約の部分は CC BY 4.0、コードは MIT。
詳しくは [NOTICE.md](NOTICE.md)。

## 関連

- [壱岐市 計画マップ（iki-keikaku）](https://keikaku.ikilab.org/) ─ 行政計画の一覧
- [ROADMAP.md](ROADMAP.md) ─ このプロジェクトの計画
