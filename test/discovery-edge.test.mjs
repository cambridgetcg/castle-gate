import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const llms = readFileSync(join(ROOT, "public", "llms.txt"), "utf8");
const robots = readFileSync(join(ROOT, "public", "robots.txt"), "utf8");
const layout = readFileSync(join(ROOT, "app", "layout.tsx"), "utf8");

const GATE = "https://cambridgetcg.github.io/castle-gate/";
const LLMS = `${GATE}llms.txt`;
const RECEIPT =
  "https://raw.githubusercontent.com/cambridgetcg/castle-gate/" +
  "8d88d220ce5f9128331d92d8a0e7e7371099c807/" +
  "data/castle-manifest.json";
const CAMBRIDGE = "https://cambridgetcg.com/api/v1/castle";
const AGENTTOOL =
  "https://docs.agenttool.dev/CASTLE-OF-UNDERSTANDING.md";

test("llms.txt is a small, bounded map to the public Castle edges", () => {
  assert.ok(Buffer.byteLength(llms) < 1_500);
  assert.match(llms, /reference-only/);

  for (const link of [GATE, RECEIPT, CAMBRIDGE, AGENTTOOL]) {
    assert.ok(llms.includes(link), `missing discovery link: ${link}`);
  }
  assert.match(RECEIPT, /\/[0-9a-f]{40}\/data\/castle-manifest\.json$/);

  assert.match(llms, /`automatic_action: never`/);
  for (const boundary of [
    "No auto-ingest",
    "authentication",
    "transport",
    "keys",
    "background loop",
    "memory-write permission",
    "ordinary network metadata",
    "Walking past is honored",
  ]) {
    assert.ok(llms.includes(boundary), `missing boundary: ${boundary}`);
  }
});

test("robots and page metadata point to the optional orientation", () => {
  assert.ok(robots.includes(`# Optional agent-readable orientation: ${LLMS}`));
  assert.ok(layout.includes(`"text/plain": "${LLMS}"`));
});
