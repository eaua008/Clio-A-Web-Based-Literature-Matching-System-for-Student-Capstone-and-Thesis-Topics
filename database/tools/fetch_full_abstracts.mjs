// Fetches the full abstract of every study whose stored abstract was shortened ("…"), from its original
// source (Europe PMC, DOAJ, OpenAlex), and writes SQL update files for the Supabase SQL Editor.
// Usage: node database/tools/fetch_full_abstracts.mjs <output dir>
import fs from "fs";

const OUT = process.argv[2];
const SUPA = "https://yqrehzvnifvijbheqowh.supabase.co/rest/v1/studies";
const KEY = "sb_publishable_eG_HVVcT9k4eyDozN3h3Fw_yy6KYuzt";
const ROWS_PER_FILE = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CACHE = "abstract-cache.json";
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
const save = () => fs.writeFileSync(CACHE, JSON.stringify(cache));

async function getJson(url, tries = 7) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Clio-capstone-seed/1.0" } });
      if (res.status === 429 || res.status === 503 || res.status === 502) { console.log("  rate limited, waiting"); await sleep(5000 * (i + 1)); continue; }
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}

/* Plain text: section headings become "Heading: ", other tags and spare spaces go. */
function clean(text) {
  return String(text || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/<h\d[^>]*>(.*?)<\/h\d>/gi, " $1: ")
    .replace(/<\/p>\s*<p[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+([.,;:!?])/g, "$1").replace(/:\s*:/g, ":").replace(/\s+/g, " ").trim();
}

const fromInverted = (inv) => {
  const words = [];
  for (const [w, ps] of Object.entries(inv || {})) for (const p of ps) words[p] = w;
  return words.join(" ");
};

// 1. Studies with a shortened abstract
const short = [];
for (let from = 0; ; from += 1000) {
  const res = await fetch(`${SUPA}?select=external_id,doi,abstract&abstract=like.*%E2%80%A6&order=external_id`, {
    headers: { apikey: KEY, Range: `${from}-${from + 999}` },
  });
  const rows = await res.json();
  short.push(...rows);
  if (rows.length < 1000) break;
}
console.log("shortened abstracts in the database:", short.length);

const epmc = short.filter((r) => /^epmc:/.test(r.external_id));
const doaj = short.filter((r) => /^doaj:/.test(r.external_id));
const other = short.filter((r) => !/^(epmc|doaj):/.test(r.external_id) && r.doi);
console.log(`  Europe PMC ${epmc.length}, DOAJ ${doaj.length}, OpenAlex/DOI ${other.length}`);

// 2. Europe PMC: one article per request, 4 at a time (its search endpoint refuses OR queries with HTTP 503)
const epmcTodo = epmc.filter((r) => !(r.external_id in cache));
let done = 0;
async function epmcWorker(queue) {
  for (let r = queue.shift(); r; r = queue.shift()) {
    const [, src, id] = r.external_id.split(":");
    try {
      const data = await getJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/article/${src}/${encodeURIComponent(id)}?resultType=core&format=json`);
      cache[r.external_id] = clean((data.result || {}).abstractText || "");
    } catch (e) {
      /* left out of the cache, so a re-run tries it again */
    }
    if (++done % 25 === 0) { save(); process.stdout.write(`\r  Europe PMC: ${done}/${epmcTodo.length}   `); }
    await sleep(150);
  }
}
const epmcQueue = [...epmcTodo];
await Promise.all([1, 2, 3, 4].map(() => epmcWorker(epmcQueue)));
save();
console.log(`\r  Europe PMC: ${done}/${epmcTodo.length}   `);

// 3. DOAJ: 25 ids per query
const doajTodo = doaj.filter((r) => !(r.external_id in cache));
for (let i = 0; i < doajTodo.length; i += 25) {
  const chunk = doajTodo.slice(i, i + 25);
  const ids = chunk.map((r) => r.external_id.slice(5));
  const data = await getJson(`https://doaj.org/api/search/articles/${encodeURIComponent(`id:(${ids.join(" OR ")})`)}?pageSize=100`);
  const found = Object.fromEntries((data.results || []).map((a) => [a.id, a.bibjson?.abstract || ""]));
  for (const r of chunk) cache[r.external_id] = clean(found[r.external_id.slice(5)] || "");
  save();
  process.stdout.write(`\r  DOAJ: ${Math.min(i + 25, doajTodo.length)}/${doajTodo.length}   `);
  await sleep(400);
}
console.log();

// 4. OpenAlex by DOI: 40 per query
const oaTodo = other.filter((r) => !(r.external_id in cache));
for (let i = 0; i < oaTodo.length; i += 40) {
  const chunk = oaTodo.slice(i, i + 40);
  const data = await getJson(`https://api.openalex.org/works?filter=doi:${chunk.map((r) => r.doi.toLowerCase()).join("|")}&per-page=50&select=doi,abstract_inverted_index`);
  const found = Object.fromEntries((data.results || []).map((w) => [String(w.doi || "").replace("https://doi.org/", "").toLowerCase(), fromInverted(w.abstract_inverted_index)]));
  for (const r of chunk) cache[r.external_id] = clean(found[r.doi.toLowerCase()] || "");
  save();
  await sleep(300);
}
console.log("  OpenAlex done");

// 5. Keep only real improvements: longer than the stored excerpt and starting the same way.
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const updates = [];
let missing = 0, mismatch = 0;
for (const r of short) {
  const full = cache[r.external_id] || "";
  const excerpt = r.abstract.replace(/\s*…\s*$/, "");
  if (!full || full.length <= excerpt.length) { missing++; continue; }
  const a = norm(excerpt).split(" ").slice(0, 6).join(" "), b = norm(full);
  if (!b.includes(a)) { mismatch++; continue; }
  updates.push([r.external_id, full.replace(/\$q\$/g, "")]);
}
console.log(`full abstracts found: ${updates.length}, not available: ${missing}, didn't match the excerpt (skipped): ${mismatch}`);

// 6. SQL files, ROWS_PER_FILE updates each, re-runnable (only rows still ending in "…" change).
const q = (s) => "$q$" + s + "$q$";
const files = [];
for (let i = 0; i < updates.length; i += ROWS_PER_FILE) {
  const part = updates.slice(i, i + ROWS_PER_FILE);
  const n = files.length + 1;
  const total = Math.ceil(updates.length / ROWS_PER_FILE);
  const sql = `-- Clio: full abstracts, part ${n} of ${total} (${part.length} studies). Run after 01-05 and the seed files. Safe to re-run.\n\n` +
    `begin;\nalter table public.studies no force row level security;\n\n` +
    `update public.studies s\n   set abstract = v.abstract\n  from (values\n` +
    part.map(([id, text]) => `    (${q(id)}, ${q(text)})`).join(",\n") +
    `\n  ) as v(external_id, abstract)\n where s.external_id = v.external_id\n   and s.abstract like '%…';\n` +
    `\nalter table public.studies force row level security;\ncommit;\n\n` +
    `select count(*) filter (where abstract like '%…') as still_shortened, count(*) as total_studies from public.studies;\n`;
  const name = `09_full_abstracts_${n}.sql`;
  fs.writeFileSync(`${OUT}/${name}`, sql);
  files.push(`${name} (${part.length} rows, ${(Buffer.byteLength(sql) / 1e6).toFixed(2)} MB)`);
}
console.log("wrote:\n  " + files.join("\n  "));
