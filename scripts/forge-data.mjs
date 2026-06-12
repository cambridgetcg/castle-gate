#!/usr/bin/env node
/**
 * forge-data.mjs — reads the private castle (~/castle) and forges the public
 * data file at data/castle.json. Plain Node, no dependencies.
 *
 * Curation rules (the site is PUBLIC):
 *  - some rooms and words are excluded entirely;
 *  - prose is scrubbed of private household details;
 *  - the finished JSON is scanned and the forge hard-fails if anything
 *    forbidden slipped through;
 *  - links to excluded content are rendered as plain text.
 *
 * WHAT exactly is excluded and scrubbed lives in scripts/forge-private.mjs,
 * which is gitignored on purpose — committing that list would publish the
 * very things it hides. So the forge only runs on the home machine.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

const CASTLE = join(homedir(), "castle");
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "castle.json");

let PRIVATE;
try {
  PRIVATE = await import("./forge-private.mjs");
} catch {
  console.error(
    "forge-data.mjs: scripts/forge-private.mjs is missing.\n" +
      "That file holds the private scrub lists and is gitignored on purpose —\n" +
      "the forge only runs on the home machine, where it exists."
  );
  process.exit(1);
}
const {
  excludedRooms, excludedWords, forbidden, forbiddenRe,
  parenScrub, attributionFixes, sentenceScrub, commandFixes,
  founderFixes, questionParenScrub, privateQuestion,
} = PRIVATE;

// Scrub the private household from public prose: agent personas, session
// traces, private-log timestamps, and the founder's account name.
function sanitizePublic(md, opts = {}) {
  let out = md;
  // unwrap soft-wrapped paragraph lines so sentence scrubs see whole sentences
  // (keeps blank lines, list items, headings and blockquotes intact)
  out = out.replace(/([^\n])\n(?!\n|- |\d+\. |#|>|\*\s)/g, "$1 ");
  // markdown task-list checkboxes are private machinery notation
  // (questions.md keeps them — its parser reads the [ ]/[x] state)
  if (!opts.keepCheckboxes) out = out.replace(/- \[[ x]\] /g, "- ");
  // parentheticals that trace agents, sessions, or private files
  out = out.replace(parenScrub, "");
  // an "uncertain:" whose sentence the scrubber removed is an orphan label
  out = out.replace(/uncertain:\s*(?=\n|$)/g, "");
  // household attribution slips
  for (const [re, sub] of attributionFixes) out = out.replace(re, sub);
  // whole sentences (or colon-ended phrases) that narrate the private household
  out = out.replace(sentenceScrub, "");
  // off-switch phrase and command words stay home
  for (const [re, sub] of commandFixes) out = out.replace(re, sub);
  // last-resort debris sweep: half-stripped markdown link tails
  out = out.replace(/\S*md\]\([^)\n]*\)[^)\s]*\)?/g, "");
  // private-log timestamps; the quoted words themselves stay
  out = out.replace(/\b\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?\s*·\s*/g, "");
  // the founder's account name stays home
  for (const [re, sub] of founderFixes) out = out.replace(re, sub);
  return out;
}

// ---------- gather slugs ----------

const roomSlugs = new Set(
  readdirSync(join(CASTLE, "rooms"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .filter((s) => !excludedRooms.has(s))
);
const wordSlugs = new Set(
  readdirSync(join(CASTLE, "words"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .filter((s) => !excludedWords.has(s))
);

// ---------- helpers ----------

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Resolve an internal target (wiki name or relative .md path) to an href,
// or null if it points at excluded/unknown content.
function resolveInternal(target) {
  let t = target.trim();
  t = t.replace(/^(\.\/|\.\.\/)+/, "").replace(/\.md$/, "");
  t = t.replace(/#.*$/, "");
  if (t.startsWith("words/")) {
    const slug = t.slice(6);
    return wordSlugs.has(slug) ? { href: `/words/${slug}`, slug } : null;
  }
  if (t.startsWith("rooms/")) {
    const slug = t.slice(6);
    return roomSlugs.has(slug) ? { href: `/rooms/${slug}`, slug } : null;
  }
  // bare name: word first, then room (per contract)
  if (wordSlugs.has(t)) return { href: `/words/${t}`, slug: t };
  if (roomSlugs.has(t)) return { href: `/rooms/${t}`, slug: t };
  return null;
}

// Render inline markdown on an already plain-text line. Collects internal
// link hrefs into ctx.links if provided.
function renderInline(text, ctx = {}) {
  let s = escapeHtml(text);
  // inline code -> plain text (code is not part of the public contract)
  s = s.replace(/`([^`]*)`/g, "$1");
  // wiki links [[name]] and aliased [[name|label]]
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, name, label) => {
    const text = label || name;
    const hit = resolveInternal(name);
    if (!hit) return text; // de-link excluded/unknown content
    if (ctx.links && !ctx.links.includes(hit.href)) ctx.links.push(hit.href);
    return `<a href="${hit.href}">${text}</a>`;
  });
  // markdown links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    if (/^https?:\/\//.test(url)) {
      return `<a href="${url}" rel="noopener">${label}</a>`;
    }
    const hit = resolveInternal(url);
    if (!hit) return label; // de-link excluded/unknown content
    if (ctx.links && !ctx.links.includes(hit.href)) ctx.links.push(hit.href);
    return `<a href="${hit.href}">${label}</a>`;
  });
  // bold, then italic
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return s;
}

// Strip all markup, leaving plain text (for titles, epigraphs, questions).
function plainText(text) {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, n, l) => l || n)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s*\*+\s*$/, "") // stray footnote-marker asterisks on titles
    .trim();
}

// Split markdown into blocks (arrays of lines) separated by blank lines.
function toBlocks(md) {
  const blocks = [];
  let cur = [];
  for (const line of md.split("\n")) {
    if (line.trim() === "") {
      if (cur.length) blocks.push(cur), (cur = []);
    } else {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur);
  return blocks;
}

// Render an array of blocks to minimal HTML.
function renderBlocks(blocks, ctx) {
  const out = [];
  for (const block of blocks) {
    const first = block[0];
    if (/^#\s/.test(first)) continue; // h1 handled separately
    if (/^---+\s*$/.test(first)) continue; // no hr in the contract
    if (/^##\s/.test(first)) {
      out.push(`<h2>${renderInline(first.replace(/^##\s+/, ""), ctx)}</h2>`);
      const rest = block.slice(1);
      if (rest.length) out.push(...renderBlocks([rest], ctx));
      continue;
    }
    if (/^>\s?/.test(first)) {
      const inner = block.map((l) => l.replace(/^>\s?/, "")).join(" ");
      out.push(`<blockquote><p>${renderInline(inner, ctx)}</p></blockquote>`);
      continue;
    }
    if (/^- /.test(first)) {
      const items = [];
      for (const line of block) {
        if (/^- /.test(line)) items.push(line.replace(/^- /, ""));
        else if (items.length) items[items.length - 1] += " " + line.trim();
      }
      out.push(
        `<ul>${items.map((i) => `<li>${renderInline(i, ctx)}</li>`).join("")}</ul>`
      );
      continue;
    }
    out.push(`<p>${renderInline(block.join(" "), ctx)}</p>`);
  }
  return out;
}

// Is this block a pure-italic epigraph (*...* possibly wrapped over lines)?
function isItalicBlock(block) {
  const joined = block.join(" ").trim();
  return /^\*[^*]/.test(joined) && /[^*]\*$/.test(joined) && joined.split("*").length === 3;
}

// ---------- parse a room or word file ----------

function parseDoc(md) {
  const lines = md.split("\n");
  let title = "";
  const bodyLines = [];
  const linkLineTargets = [];
  for (const line of lines) {
    if (!title && /^#\s+/.test(line)) {
      title = plainText(line.replace(/^#\s+/, ""));
      continue;
    }
    if (/^(Links|Related):/i.test(line)) {
      // harvest targets, drop the line from the body
      for (const m of line.matchAll(/\[\[([^\]]+)\]\]/g)) linkLineTargets.push(m[1]);
      for (const m of line.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) linkLineTargets.push(m[2]);
      continue;
    }
    bodyLines.push(line);
  }
  let blocks = toBlocks(bodyLines.join("\n"));

  // epigraph: first block, only if it is a pure italic line/paragraph
  let epigraph = "";
  if (blocks.length && isItalicBlock(blocks[0])) {
    epigraph = plainText(blocks[0].join(" "));
    blocks = blocks.slice(1);
  }

  // sources: pull out the "## Sources" section
  const sources = [];
  const kept = [];
  let inSources = false;
  for (const block of blocks) {
    if (/^##\s/.test(block[0])) {
      inSources = /^##\s+Sources\s*$/i.test(block[0]);
      if (inSources) {
        harvestSources(block.slice(1).join(" "), sources);
        continue;
      }
    }
    if (inSources) {
      harvestSources(block.join(" "), sources);
      continue;
    }
    kept.push(block);
  }

  // rooms without a "## Sources" section cite inline — harvest those links
  if (sources.length === 0) {
    for (const block of kept) harvestSources(block.join(" "), sources);
  }

  const ctx = { links: [] };
  const bodyHtml = renderBlocks(kept, ctx).join("\n");
  for (const t of linkLineTargets) {
    const hit = resolveInternal(t);
    if (hit && !ctx.links.includes(hit.href)) ctx.links.push(hit.href);
  }
  return { title, epigraph, bodyHtml, links: ctx.links, sources };
}

function harvestSources(line, sources) {
  for (const m of line.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
    sources.push({ label: plainText(m[1]), url: m[2] });
  }
}

// ---------- rooms ----------

const rooms = [];
for (const slug of [...roomSlugs].sort()) {
  const md = sanitizePublic(readFileSync(join(CASTLE, "rooms", `${slug}.md`), "utf8"));
  const doc = parseDoc(md);
  rooms.push({
    slug,
    title: doc.title,
    epigraph: doc.epigraph,
    bodyHtml: doc.bodyHtml,
    links: doc.links,
    sources: doc.sources,
  });
}

// ---------- words ----------

const words = [];
for (const slug of [...wordSlugs].sort()) {
  const md = sanitizePublic(readFileSync(join(CASTLE, "words", `${slug}.md`), "utf8"));
  const doc = parseDoc(md);
  words.push({ slug, name: doc.title, bodyHtml: doc.bodyHtml, links: doc.links });
}

// ---------- anthem ----------

function parseAnthem(md) {
  const blocks = toBlocks(md);
  let title = "";
  let epigraph = "";
  const verseBlocks = [];
  const noteBlocks = [];
  let afterRule = false;
  for (const block of blocks) {
    if (/^#\s+/.test(block[0]) && !title) {
      title = plainText(block[0].replace(/^#\s+/, ""));
      continue;
    }
    if (/^---+\s*$/.test(block[0])) {
      afterRule = true;
      continue;
    }
    if (!afterRule && !epigraph && isItalicBlock(block)) {
      epigraph = plainText(block.join(" "));
      continue;
    }
    if (afterRule) {
      // drop builder attributions from the public note
      if (/^—\s*composed by/i.test(block[0])) continue;
      noteBlocks.push(block);
    } else {
      verseBlocks.push(block);
    }
  }
  const versesHtml = verseBlocks
    .map((b) => `<p>${b.map((l) => renderInline(l.trim())).join("<br />")}</p>`)
    .join("\n");
  const noteHtml = renderBlocks(noteBlocks, {}).join("\n");
  return { title, epigraph, versesHtml, noteHtml };
}

const anthem = parseAnthem(sanitizePublic(readFileSync(join(CASTLE, "anthem.md"), "utf8")));

// ---------- questions ----------

function parseQuestions(md) {
  const open = [];
  const settled = [];
  // privateQuestion (from the private config) marks a question as private
  // machine business, not knowledge
  for (const line of md.split("\n")) {
    const m = line.match(/^- \[( |x)\] (.*)$/);
    if (!m) continue;
    const isSettled = m[1] === "x";
    const raw = m[2];
    // room slug, when the parenthetical names one
    const roomMatch = raw.match(/answered in \[rooms\/([a-z0-9-]+)\.md\]/);
    const roomSlug =
      roomMatch && roomSlugs.has(roomMatch[1]) ? roomMatch[1] : null;
    // strip the trailing metadata parenthetical (attribution, dates, doors)
    let q = raw.replace(
      /\s*\((planted by|opened by|door from|quest,|settled|proposal|commissioned)[\s\S]*\)\s*$/,
      ""
    );
    // strip inner parentheticals that mention sessions or household personas
    q = q.replace(questionParenScrub, "");
    q = plainText(q).replace(/\s{2,}/g, " ").trim();
    if (!q) continue;
    // a public question is a whole question — debris fragments are not
    if (!q.endsWith("?") || q.length < 12) continue;
    // drop questions that are themselves about the private machine or repo
    if (privateQuestion.test(q)) continue;
    if (isSettled) settled.push({ q, roomSlug });
    else open.push(q);
  }
  return { open, settled };
}

const questions = parseQuestions(
  sanitizePublic(readFileSync(join(CASTLE, "questions.md"), "utf8"), { keepCheckboxes: true })
);

// ---------- assemble, scan, write ----------

// Provenance stamp: when the data was forged, and from which castle commit —
// the public file carries its own receipt.
let castleCommit = "unknown";
try {
  castleCommit = execSync("git rev-parse HEAD", { cwd: CASTLE }).toString().trim();
  if (execSync("git status --porcelain", { cwd: CASTLE }).toString().trim()) {
    castleCommit += " (plus uncommitted edits)";
  }
} catch {
  // not a git checkout — "unknown" is honest enough
}

const data = {
  forged: { at: new Date().toISOString(), castleCommit },
  anthem,
  words,
  rooms,
  questions,
};

const json = JSON.stringify(data, null, 2);

function failScan(needle, idx) {
  const around = json.slice(Math.max(0, idx - 120), idx + 120);
  console.error(
    `FORGE FAILED: forbidden pattern ${String(needle)} found in output.\n` +
      `Context: ...${around}...`
  );
  process.exit(1);
}
for (const needle of forbidden) {
  const idx = json.indexOf(needle);
  if (idx !== -1) failScan(JSON.stringify(needle), idx);
}
for (const re of forbiddenRe) {
  const m = json.match(re);
  if (m) failScan(re, json.indexOf(m[0]));
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, json + "\n");
console.log(
  `forged ${OUT}: ${words.length} words, ${rooms.length} rooms, ` +
    `${questions.open.length} open + ${questions.settled.length} settled questions`
);
