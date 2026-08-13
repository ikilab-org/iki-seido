/**
 * build_dataset.js — 壱岐市 組織例規データセット生成スクリプト
 *
 * モック(A: 組織図 / C: タイムライン)に埋め込んだ構造化データを取り込み、
 * 公開用のフラットなスキーマ(JSON + CSV)に変換する。
 * 本番では parse_reiki.py が例規HTMLから同じスキーマを直接生成する想定。
 *
 * 使い方: node build_dataset.js <data_a.js> <data_c.js> <outdir>
 */
const fs = require("fs");
const path = require("path");

const [, , srcA, srcC, outdir] = process.argv;
const { SOURCES, BRANCHES } = require(path.resolve(srcA));
const { JOREI, KISOKU, KYOIKU } = require(path.resolve(srcC));

const AS_OF = "2026-08-11"; // 例規ページ取得日

/* ---------- 組織ユニットのフラット化 ---------- */
function levelOf(node) {
  if (node.cls === "bu") return "部";
  if (node.cls === "ka") return "課";
  if (node.cls === "kyo") return node.kids ? "課" : "班";
  if (node.cls === "etc") return "出先機関";
  if (node.cls === "han") return node.kids ? "室" : "班";
  return "その他";
}
const units = [];
const duties = [];
let uSeq = 0, dSeq = 0;
function walk(node, parentId, branchTitle) {
  const id = "u" + String(++uSeq).padStart(3, "0");
  units.push({
    id,
    name: node.n,
    level: levelOf(node),
    parent_id: parentId,
    branch: branchTitle,
    legal_source: node.legal,
    article: node.art || null,
    note: node.note || null,
    duty_count: (node.duties || []).length
  });
  (node.duties || []).forEach((t, i) => {
    duties.push({
      id: "d" + String(++dSeq).padStart(4, "0"),
      unit_id: id,
      unit_name: node.n,
      seq: i + 1,
      text: t,
      legal_source: node.legal,
      article: node.art || null
    });
  });
  (node.kids || []).forEach(k => walk(k, id, branchTitle));
}
BRANCHES.forEach(b => b.nodes.forEach(n => walk(n, null, b.title)));

/* ---------- 改正沿革 ---------- */
const amendments = [];
JOREI.forEach(e => amendments.push({
  source: "jorei", promulgated_on: e[0], enforced_on: e[1] || null,
  number: e[2], kind: e[3] || "改正"
}));
KISOKU.forEach(e => amendments.push({
  source: "kisoku", recorded_on: e[0], number: e[1], kind: e[2] || "改正"
}));
KYOIKU.forEach(e => amendments.push({
  source: "kyoiku", recorded_on: e[0], number: e[1], kind: e[2] || "改正"
}));

/* ---------- JSON ---------- */
const dataset = {
  name: "iki-city-administrative-organization",
  title: "壱岐市 行政組織データセット(例規由来)",
  version: "0.1.0",
  as_of: AS_OF,
  license_note: "条例・規則の本文は著作権法第13条により権利の目的とならない。データセットとしての整理部分はCC BY 4.0、コードはMIT(iki-keikakuと同方針: CC0は出所が辿れなくなるため不採用)。",
  sources: Object.entries(SOURCES).map(([id, s]) => ({ id, name: s.name, url: s.url, era: s.era })),
  quality_notes: [
    "支所・事務所・会計課の分掌事務は概要のみ(原文は多数の号を列挙)",
    "教育委員会規則の分掌事務の条番号は未確定(第2条=内部組織のみ確認済み)",
    "改正沿革のrecorded_onは例規ページ沿革表記に基づき公布日と施行日が混在している可能性がある",
    "令和8年3月19日条例第4号は沿革に記載があるが附則が本文ページに見当たらず内容未確認"
  ],
  organization: units,
  duties,
  amendments
};

/* ---------- CSV (UTF-8 BOM, Excel対応) ---------- */
function csv(rows, cols) {
  const escCell = v => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return "﻿" + cols.join(",") + "\n" +
    rows.map(r => cols.map(c => escCell(r[c])).join(",")).join("\n") + "\n";
}
fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(path.join(outdir, "iki-seido-org.json"), JSON.stringify(dataset, null, 2));
fs.writeFileSync(path.join(outdir, "org_units.csv"),
  csv(units, ["id", "name", "level", "parent_id", "branch", "legal_source", "article", "duty_count", "note"]));
fs.writeFileSync(path.join(outdir, "duties.csv"),
  csv(duties, ["id", "unit_id", "unit_name", "seq", "text", "legal_source", "article"]));
fs.writeFileSync(path.join(outdir, "amendments.csv"),
  csv(amendments, ["source", "promulgated_on", "enforced_on", "recorded_on", "number", "kind"]));

console.log("units:", units.length, "duties:", duties.length, "amendments:", amendments.length);
console.log("levels:", JSON.stringify(units.reduce((a, u) => (a[u.level] = (a[u.level] || 0) + 1, a), {})));
