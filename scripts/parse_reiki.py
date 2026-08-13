#!/usr/bin/env python3
"""
parse_reiki.py — 壱岐市例規HTML → 組織データセット 自動生成パイプライン(骨格)

v0.1 のデータセットはLLM支援の半手動抽出で作った。本スクリプトはそれを
再現可能な自動処理に置き換えるための骨格で、iki-watch が改正を検知したら
これを回して新版を生成する、という運用を想定している。

想定フロー:
  1. fetch    : 例規ページを取得(キャッシュ保存 — 差分・監査の元にもなる)
  2. parse    : 条文構造(条・項・号)と沿革をパース
  3. build    : org_units / duties / amendments に整形
  4. diff     : 前版と比較して新旧対照を生成(改正検知時)
  5. publish  : JSON/CSV/datapackage を書き出し、バージョンを上げる

注意:
  - 例規集ページの利用規約・robots.txt を確認のこと(条文自体は著作権法13条
    により権利の目的とならないが、アクセスマナーは別問題)。
  - 例規集は第一法規/ぎょうせい系のCMSが多く、HTML構造はほぼ定型。
    ただし全角括弧・漢数字・改行位置などの揺れがあるので正規表現は保守的に。
"""
from __future__ import annotations
import json
import re
import time
import pathlib
import urllib.request

REIKI = {
    "jorei":  "https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000958.html",
    "kisoku": "https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000018.html",
    "kyoiku": "https://www.city.iki.nagasaki.jp/section/reiki/reiki_honbun/r014RG00000190.html",
}
CACHE = pathlib.Path("cache")
OUT = pathlib.Path("data")

# 条・号・沿革のパターン(第一法規系の本文テキストを想定した最初の一手)
RE_ARTICLE = re.compile(r"^第([一二三四五六七八九十百]+|\d+)条(の\d+)?")
RE_ITEM = re.compile(r"^[(（](\d+)[)）]\s*(.+)$")            # (1) 号
RE_HISTORY = re.compile(
    r"(平成|令和)(\d+|元)年(\d+)月(\d+)日(条例|規則|教育委員会規則)第(\d+)号"
)


def fetch(reiki_id: str, url: str, sleep: float = 2.0) -> str:
    """例規ページを取得してキャッシュに保存(取得日はファイル名に刻む)。"""
    CACHE.mkdir(exist_ok=True)
    stamp = time.strftime("%Y%m%d")
    path = CACHE / f"{reiki_id}-{stamp}.html"
    if path.exists():
        return path.read_text(encoding="utf-8")
    req = urllib.request.Request(url, headers={"User-Agent": "ikilab-reiki-watch/0.1"})
    with urllib.request.urlopen(req) as r:
        html = r.read().decode("utf-8", errors="replace")
    path.write_text(html, encoding="utf-8")
    time.sleep(sleep)  # 行儀よく
    return html


def strip_html(html: str) -> list[str]:
    """タグを落として本文の行リストへ。実装時はBeautifulSoupに置き換え推奨。"""
    text = re.sub(r"<script.*?</script>", "", html, flags=re.S)
    text = re.sub(r"<style.*?</style>", "", text, flags=re.S)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = re.sub(r"&nbsp;", " ", text)
    return [ln.strip() for ln in text.splitlines() if ln.strip()]


def parse_history(lines: list[str]) -> list[dict]:
    """ページ冒頭の沿革(改正例規番号の羅列)を拾う。"""
    out = []
    for ln in lines[:80]:  # 沿革はページ冒頭に集中している
        for m in RE_HISTORY.finditer(ln):
            era, y, mo, d, kind, num = m.groups()
            year = (1988 if era == "平成" else 2018) + (1 if y == "元" else int(y))
            out.append({
                "recorded_on": f"{year:04d}-{int(mo):02d}-{int(d):02d}",
                "number": f"{kind}第{num}号",
            })
    return out


def parse_articles(lines: list[str]) -> list[dict]:
    """条文を「条 → 号リスト」に分解する。
    TODO: 壱岐市の行政組織規則第4条は「課名見出し → 班名見出し → 号列挙」の
    入れ子なので、見出し行(〜課 / 〜班)の状態機械を足す。ここが本丸。
    """
    articles, current = [], None
    for ln in lines:
        if RE_ARTICLE.match(ln):
            current = {"heading": ln, "items": []}
            articles.append(current)
        elif current and (m := RE_ITEM.match(ln)):
            current["items"].append({"seq": int(m.group(1)), "text": m.group(2)})
    return articles


def build(reiki_id: str, articles: list[dict], history: list[dict]) -> dict:
    """TODO: articles から org_units / duties を組み立てる。
    v0.1 の出力(iki-seido-org.json)と同スキーマにすること。
    照合テスト: units=96 / duties=597 / amendments=57 に一致すれば移行完了。
    """
    raise NotImplementedError("scripts/build_dataset.js のスキーマに合わせて実装する")


def main() -> None:
    for reiki_id, url in REIKI.items():
        html = fetch(reiki_id, url)
        lines = strip_html(html)
        history = parse_history(lines)
        articles = parse_articles(lines)
        print(f"{reiki_id}: 条 {len(articles)} / 沿革 {len(history)} 件を検出")
        # build(reiki_id, articles, history)  # TODO


if __name__ == "__main__":
    main()
