#!/usr/bin/env bun
import { Database } from 'bun:sqlite';

const db = new Database('output/shard-00.db');

const motifs = db.prepare(
  "SELECT DISTINCT motif_id FROM verb_records WHERE motif_id IS NOT NULL ORDER BY motif_id"
).all() as Array<{ motif_id: string }>;

console.log("motif_id                                 | domains | methods | avg_conf | conflicts | components | blockers");
console.log("-".repeat(130));

for (const m of motifs) {
  const mid = m.motif_id;

  const d = db.prepare(
    "SELECT COUNT(DISTINCT domain) as c FROM verb_records WHERE motif_id = ? AND domain IS NOT NULL"
  ).get(mid) as { c: number };

  const meth = db.prepare(
    "SELECT COUNT(DISTINCT extraction_method) as c FROM verb_records WHERE motif_id = ?"
  ).get(mid) as { c: number };

  const conf = db.prepare(
    "SELECT AVG(motif_confidence) as a FROM verb_records WHERE motif_id = ?"
  ).get(mid) as { a: number };

  const confl = db.prepare(
    `SELECT COUNT(*) as c FROM verb_records v1
     JOIN verb_records v2 ON v1.source_content_hash = v2.source_content_hash
     WHERE v1.motif_id = ? AND v2.motif_id != ? AND v2.motif_confidence > v1.motif_confidence`
  ).get(mid, mid) as { c: number };

  const comp = db.prepare(
    "SELECT COUNT(DISTINCT source_component) as c FROM verb_records WHERE motif_id = ?"
  ).get(mid) as { c: number };

  const b: string[] = [];
  if (d.c < 3) b.push("domains<3");
  if (meth.c < 2) b.push("methods<2");
  if (conf.a < 0.3) b.push("conf<0.3");
  if (confl.c > 0) b.push(`CONFLICT(${confl.c})`);

  const line = [
    mid.padEnd(42),
    String(d.c).padStart(7),
    String(meth.c).padStart(7),
    conf.a.toFixed(3).padStart(8),
    String(confl.c).padStart(9),
    String(comp.c).padStart(10),
    b.length === 0 ? "PASS" : b.join(", "),
  ].join(" | ");

  console.log(line);
}

db.close();
