# セットアップ手順

GitHub Pages ＋ 独自ドメイン（`seido.ikilab.org`）で公開するまでの手順です。

## 前提

- Node.js 20 以上（`node --version` で確認）
- 外部依存はありません。`npm install` は不要です
- （任意）[GitHub CLI](https://cli.github.com/) — あると Step 3〜4 が1コマンドで済みます

```bash
node --version   # v20.0.0 以上であること
gh --version     # 任意。入っていなくても手順は進められます
```

## リポジトリを取得する

```bash
git clone https://github.com/ikilab-org/iki-seido.git
cd iki-seido
node --test
```

`# pass 53` `# fail 0` が出れば、手元の環境で変換ロジックが正しく動いています。

## 手元で確認する

```bash
node tools/validate.mjs
node tools/linkmap.mjs
node tools/build.mjs
git diff --exit-code   # 何も出なければ、リポジトリの生成物は最新
```

生成が終わったら `index.html` をブラウザで直接開きます（サーバは不要です）。

```bash
open index.html          # macOS
# または xdg-open index.html（Linux）/ start index.html（Windows）
```

ハブページから組織図・逆引き検索・改正タイムラインの3ページに遷移できることを確認してください。

## GitHub Pages を有効にする

**GitHub CLI を使う場合**

```bash
gh api -X POST repos/ikilab-org/iki-seido/pages -f 'source[branch]=main' -f 'source[path]=/'
```

**画面から行う場合**

1. リポジトリの **Settings** → 左メニューの **Pages**
2. **Build and deployment** の **Source** を `Deploy from a branch` に
3. **Branch** を `main` / `/ (root)` にして **Save**

1〜2分待つと、ページ上部に `Your site is live at https://ikilab-org.github.io/iki-seido/` と表示されます。
まずこの `github.io` の URL で表示を確認してください。ここで表示されていれば、以降のトラブルは
すべて DNS かドメイン設定の問題と切り分けられます。

## 独自ドメインをつなぐ

リポジトリ直下の `CNAME` の中身が `seido.ikilab.org` の1行であることを確認します。

```bash
cat CNAME
# seido.ikilab.org
```

ikilab.org を管理している DNS に、次の CNAME レコードを1件追加します。

| 種別 | 名前（ホスト） | 値（あて先） |
|---|---|---|
| CNAME | `seido` | `ikilab-org.github.io.` |

反映されたかどうかは `dig` で確認します。

```bash
dig +short seido.ikilab.org
# → ikilab-org.github.io. が返れば OK
```

返ってくるまで、**Settings → Pages → Custom domain** への入力には進まないでください。
DNS が引けない状態でカスタムドメインを設定すると、GitHub 側でエラーになり、やり直しが必要になります。
`dig` が返るようになったら、**Custom domain** に `seido.ikilab.org` を入力して **Save** します。

## HTTPS を強制する

```bash
gh api -X PUT repos/ikilab-org/iki-seido/pages -F https_enforced=true
```

画面から行う場合は **Settings → Pages → Enforce HTTPS** にチェックを入れます。

証明書（Let's Encrypt）の発行に数分〜1時間ほどかかります。「Certificate not yet created」と
出ているあいだはそのまま待ってください。チェックボックスが押せない場合は、まだ発行中です。

## 詰まりやすい点

- **DNS の伝播に時間がかかること。** `dig +short seido.ikilab.org` が空、または古い値を返す間は
  数分〜30分待ってから再実行してください。DNS が引けないまま先の手順に進むとエラーになり、
  やり直しが必要になります
- **`.nojekyll` がないと `tools/__fixtures__` が配信されないこと。** GitHub Pages は既定で Jekyll
  ビルドを通し、`_` や `__` で始まるディレクトリを除外します。リポジトリ直下に `.nojekyll` が
  あることを確認してください（`ls -la .nojekyll`）。無い場合はビルドを経由せず空ファイルとして追加します
- **`CNAME` を消すと独自ドメインの設定が外れること。** `git rm CNAME` や上書きコミットをすると、
  次のデプロイで GitHub Pages のカスタムドメイン設定がリセットされます。ドメインを変えたいとき以外は
  触らないでください
