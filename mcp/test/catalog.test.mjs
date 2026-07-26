import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CatalogError,
  MAX_DOCUMENTS,
  MAX_RESULTS,
  containsLocalPathReference,
  createCatalog,
  htmlToText,
  loadReceiptPinnedCatalog,
  readBoundedRegularFile,
  selectReceiptPinnedPayload,
} from "../src/catalog.mjs";
import { readCommittedPayload } from "../../scripts/castle-manifest.mjs";

const MANIFEST = {
  protocol: "castle-understanding/v0.1",
  forged_at: "2026-07-07T21:45:49.583Z",
  source: {
    repository_id: "repo:cambridgetcg/castle-of-words",
    revision: "a".repeat(40),
  },
  payload: {
    digest: `sha256:${"b".repeat(64)}`,
    locator:
      "https://raw.githubusercontent.com/cambridgetcg/castle-gate/" +
      `${"c".repeat(40)}/data/castle.json`,
  },
  privacy: {
    scope: "public_curated",
    coverage: "not_exhaustive",
    raw_source_included: false,
    curation_profile: "castle-gate-public/v1",
    secure_recall: "not_guaranteed",
  },
  rights: {
    spdx: "NOASSERTION",
    grant: "none_declared",
  },
  authority: {
    automatic_action: "never",
  },
  return: {
    public_correction: "https://github.com/cambridgetcg/castle-gate/issues",
  },
};

function fixtureCatalog() {
  return createCatalog({
    manifest: MANIFEST,
    payload: {
      rooms: [
        {
          slug: "words-are-a-bridge",
          title: "Words are a bridge of understanding",
          epigraph: "Meaning is rebuilt, not shipped.",
          bodyHtml:
            "<p>Two minds build common ground together.</p><p>Repair keeps the bridge standing.</p>",
          sources: [
            {
              label: "A named source",
              url: "https://example.test/source",
            },
          ],
        },
        ...Array.from({ length: 12 }, (_, index) => ({
          slug: `other-${index}`,
          title: `Other understanding ${index}`,
          bodyHtml: "<p>Understanding appears here too.</p>",
        })),
      ],
      words: [
        {
          slug: "consent",
          name: "consent",
          bodyHtml: "<p>A current, scoped, withdrawable choice.</p>",
        },
      ],
    },
  });
}

test("htmlToText keeps prose and removes markup without executing it", () => {
  assert.equal(
    htmlToText("<p>Words &amp; meaning.</p><script>alert(1)</script><p>Next.</p>"),
    "Words & meaning.\nNext.",
  );
});

test("search is deterministic, citable, and bounded", () => {
  const catalog = fixtureCatalog();
  const first = catalog.search("words bridge");
  const second = catalog.search("words bridge");
  assert.deepEqual(second, first);
  assert.equal(first.results[0].id, "room:words-are-a-bridge");
  assert.equal(
    first.results[0].url,
    "https://cambridgetcg.github.io/castle-gate/rooms/words-are-a-bridge",
  );
  assert.ok(catalog.search("understanding").results.length <= MAX_RESULTS);
  assert.deepEqual(Object.keys(first.results[0]).sort(), ["id", "title", "url"]);
});

test("fetch returns bounded public text and narrow receipt metadata", () => {
  const catalog = fixtureCatalog();
  const fetched = catalog.fetch("room:words-are-a-bridge");
  assert.match(fetched.text, /Two minds build common ground/);
  assert.match(fetched.text, /A named source — https:\/\/example\.test\/source/);
  assert.equal(fetched.metadata.snapshot_protocol, MANIFEST.protocol);
  assert.equal(fetched.metadata.snapshot_locator, MANIFEST.payload.locator);
  assert.equal(fetched.metadata.privacy_scope, "public_curated");
  assert.equal(fetched.metadata.coverage, "not_exhaustive");
  assert.equal(fetched.metadata.raw_source_included, false);
  assert.equal(fetched.metadata.curation_profile, "castle-gate-public/v1");
  assert.equal(fetched.metadata.secure_recall, "not_guaranteed");
  assert.equal(fetched.metadata.rights_grant, "none_declared");
  assert.equal(fetched.metadata.automatic_action, "never");
  assert.doesNotMatch(JSON.stringify(fetched), /\/Users\/|file:\/\/|~\//);
});

test("invalid, oversized, and unknown inputs fail closed", () => {
  const catalog = fixtureCatalog();
  for (const call of [
    () => catalog.search(" "),
    () => catalog.search("x".repeat(513)),
    () => catalog.fetch(""),
    () => catalog.fetch("room:not-here"),
  ]) {
    assert.throws(call, CatalogError);
  }
});

test("documents with local path references are omitted whole", () => {
  const catalog = createCatalog({
    manifest: MANIFEST,
    payload: {
      rooms: [
        {
          slug: "safe-approximation",
          title: "Safe approximation",
          bodyHtml:
            "<p>The estimate is ~24; see https://home.cs.example.test/paper.</p>",
        },
        {
          slug: "local-path",
          title: "Local path",
          bodyHtml: "<p>The unpublished working copy is at ~/private.</p>",
        },
      ],
      words: [],
    },
  });
  assert.equal(catalog.size, 1);
  assert.deepEqual(catalog.omissions, {
    bounds: 0,
    localPathReferences: 1,
  });
  assert.equal(
    catalog.search("approximation").results[0].id,
    "room:safe-approximation",
  );
  assert.throws(() => catalog.fetch("room:local-path"), /No public Castle document/);
  assert.equal(containsLocalPathReference("The estimate is ~24."), false);
  assert.equal(
    containsLocalPathReference("https://home.cs.example.test/paper"),
    false,
  );
});

test("future titles cannot make tool output unbounded", () => {
  const catalog = createCatalog({
    manifest: MANIFEST,
    payload: {
      rooms: [
        {
          slug: "too-long",
          title: "x".repeat(1_025),
          bodyHtml: "<p>This document is outside the public tool bounds.</p>",
        },
      ],
      words: [],
    },
  });
  assert.equal(catalog.size, 0);
  assert.equal(catalog.omittedDocuments, 1);
  assert.equal(catalog.omissions.bounds, 1);
});

test("snapshot and raw document inputs have explicit bounds", () => {
  assert.throws(
    () =>
      createCatalog({
        manifest: MANIFEST,
        payload: {
          rooms: Array.from({ length: MAX_DOCUMENTS + 1 }, () => ({})),
          words: [],
        },
      }),
    /exceeds 4096 documents/,
  );

  const catalog = createCatalog({
    manifest: MANIFEST,
    payload: {
      rooms: [
        {
          slug: "raw-too-long",
          title: "Raw too long",
          bodyHtml: "x".repeat(65_537),
        },
        {
          slug: "too-many-sources",
          title: "Too many sources",
          bodyHtml: "<p>Bounded.</p>",
          sources: Array.from({ length: 129 }, () => ({
            label: "source",
            url: "https://example.test",
          })),
        },
      ],
      words: [],
    },
  });
  assert.equal(catalog.size, 0);
  assert.equal(catalog.omissions.bounds, 2);
});

test("the live loader serves only the receipt-pinned payload", () => {
  const catalog = loadReceiptPinnedCatalog();
  assert.equal(catalog.manifest.protocol, "castle-understanding/v0.1");
  assert.equal(catalog.manifest.privacy.scope, "public_curated");
  assert.equal(catalog.manifest.authority.automatic_action, "never");
  assert.equal(catalog.omittedDocuments, 4);
  assert.deepEqual(catalog.omissions, {
    bounds: 0,
    localPathReferences: 4,
  });
  assert.equal(
    catalog.size,
    catalog.manifest.counts.rooms +
      catalog.manifest.counts.words -
      catalog.omittedDocuments,
  );
  const result = catalog.search("meaning between minds").results[0];
  assert.equal(result.id, "room:meaning-between-minds");
  assert.match(catalog.fetch(result.id).text, /shared meaning is built/i);
});

test("every live fetch is free of local path references", () => {
  const repository = new URL("../..", import.meta.url);
  const manifest = JSON.parse(
    readFileSync(new URL("data/castle-manifest.json", repository), "utf8"),
  );
  const revision = manifest.payload.locator.match(
    /\/([0-9a-f]{40})\/data\/castle\.json$/,
  )[1];
  const payload = JSON.parse(
    readCommittedPayload({
      repoDir: fileURLToPath(repository),
      gateRevision: revision,
      maxBytes: 16 * 1_024 * 1_024,
      timeoutMs: 5_000,
    }).toString("utf8"),
  );
  const catalog = loadReceiptPinnedCatalog();
  let fetched = 0;
  let omitted = 0;
  for (const [kind, items] of [
    ["room", payload.rooms],
    ["word", payload.words],
  ]) {
    for (const item of items) {
      try {
        const document = catalog.fetch(`${kind}:${item.slug}`);
        assert.equal(
          containsLocalPathReference(JSON.stringify(document)),
          false,
          `local path reference escaped through ${kind}:${item.slug}`,
        );
        fetched += 1;
      } catch (error) {
        assert.ok(error instanceof CatalogError);
        assert.equal(error.code, "not_found");
        omitted += 1;
      }
    }
  }
  assert.equal(fetched, catalog.size);
  assert.equal(omitted, 4);
});

test("an adjacent payload is served only when its bytes match the receipt", () => {
  const repository = new URL("../..", import.meta.url);
  const manifest = JSON.parse(
    readFileSync(new URL("data/castle-manifest.json", repository), "utf8"),
  );
  const exact = readFileSync(new URL("data/castle.json", repository));
  let pinnedReads = 0;
  const selected = selectReceiptPinnedPayload({
    manifest,
    workingBytes: exact,
    readPinned: () => {
      pinnedReads += 1;
      return exact;
    },
  });
  assert.equal(selected, exact);
  assert.equal(pinnedReads, 1);

  const changed = Buffer.from(exact);
  changed[changed.length - 2] ^= 1;
  assert.equal(
    selectReceiptPinnedPayload({
      manifest,
      workingBytes: changed,
      readPinned: () => exact,
    }),
    exact,
  );
  assert.throws(
    () =>
      selectReceiptPinnedPayload({
        manifest,
        workingBytes: exact,
        readPinned: () => {
          throw new Error("no Git history");
        },
      }),
    /Local Git does not contain the bytes/,
  );
});

test("bounded file reads reject oversized and symlink inputs before reading", () => {
  const root = mkdtempSync(join(tmpdir(), "castle-mcp-bounds-"));
  const regular = join(root, "regular");
  const link = join(root, "link");
  try {
    writeFileSync(regular, "four");
    assert.equal(readBoundedRegularFile(regular, 4).toString("utf8"), "four");
    assert.throws(() => readBoundedRegularFile(regular, 3), /exceeds 3 bytes/);
    symlinkSync(regular, link);
    assert.throws(
      () => readBoundedRegularFile(link, 10),
      /regular, non-symlink file/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
