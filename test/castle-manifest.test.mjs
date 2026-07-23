import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildManifest,
  buildManifestFromRevision,
  runCli,
  serializeManifest,
  validateManifest,
  verifyManifestFromGit,
  verifyPayload,
} from "../scripts/castle-manifest.mjs";
import {
  assertForgeSafety,
  ForgeSafetyError,
  inspectCleanSource,
  writeReceiptThenPayload,
} from "../scripts/forge-safety.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAYLOAD_PATH = join(ROOT, "data", "castle.json");
const MANIFEST_PATH = join(ROOT, "data", "castle-manifest.json");
const SCHEMA_PATH = join(
  ROOT,
  "schema",
  "castle-understanding-manifest.schema.json"
);
const GATE_REVISION = "bacf9430f98301161e78bd9a8520bcf282b3b1c9";
const payloadBytes = readFileSync(PAYLOAD_PATH);

function clone(value) {
  return structuredClone(value);
}

function fixturePayload(overrides = {}) {
  return Buffer.from(
    `${JSON.stringify({
      forged: {
        at: "2026-07-07T21:45:49.583Z",
        castleCommit: "6cd9be606a6b0cc1c8dcb0743c01070ad9584edb",
        ...overrides.forged,
      },
      anthem: {},
      rooms: overrides.rooms ?? [],
      words: overrides.words ?? [],
      questions: {
        open: overrides.open ?? [],
        settled: overrides.settled ?? [],
      },
    })}\n`
  );
}

function runGit(repoDir, args) {
  return execFileSync("git", args, {
    cwd: repoDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function makeGitFixture(payload) {
  const repoDir = mkdtempSync(join(tmpdir(), "castle-manifest-git-"));
  runGit(repoDir, ["init", "-q"]);
  runGit(repoDir, ["config", "user.name", "Castle Test"]);
  runGit(repoDir, ["config", "user.email", "castle-test@example.invalid"]);
  mkdirSync(join(repoDir, "data"), { recursive: true });
  writeFileSync(join(repoDir, "data", "castle.json"), payload);
  runGit(repoDir, ["add", "data/castle.json"]);
  runGit(repoDir, ["commit", "-q", "-m", "payload A"]);
  return {
    repoDir,
    revision: runGit(repoDir, ["rev-parse", "HEAD"]),
  };
}

test("checked-in manifest is the deterministic build output", () => {
  const expected = buildManifestFromRevision({
    repoDir: ROOT,
    gateRevision: GATE_REVISION,
  });
  const current = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

  assert.equal(serializeManifest(expected), serializeManifest(current));
  assert.equal(
    runCli(
      [
        "build",
        "--check",
        "--repo",
        ROOT,
        "--gate-revision",
        GATE_REVISION,
      ],
      {}
    ),
    `manifest is current: ${MANIFEST_PATH}`
  );
});

test("digest and byte count name the exact raw payload", () => {
  const manifest = buildManifest({
    payloadBytes,
    gateRevision: GATE_REVISION,
  });
  const expectedDigest = createHash("sha256")
    .update(payloadBytes)
    .digest("hex");

  assert.equal(manifest.payload.digest, `sha256:${expectedDigest}`);
  assert.equal(manifest.payload.bytes, payloadBytes.length);
  assert.doesNotThrow(() => verifyPayload(manifest, payloadBytes));

  const changed = Buffer.concat([payloadBytes, Buffer.from("\n")]);
  assert.throws(() => verifyPayload(manifest, changed), /does not match/);
});

test("forged_at names payload forge time, not manifest creation time", () => {
  const manifest = buildManifest({
    payloadBytes: fixturePayload(),
    gateRevision: GATE_REVISION,
  });
  assert.equal(manifest.forged_at, "2026-07-07T21:45:49.583Z");
  assert.equal(Object.hasOwn(manifest, "created_at"), false);

  const misnamed = clone(manifest);
  misnamed.created_at = misnamed.forged_at;
  delete misnamed.forged_at;
  assert.throws(() => validateManifest(misnamed), /must contain only/);
});

test("closed manifest rejects unknown top-level and nested fields", () => {
  const manifest = buildManifest({
    payloadBytes: fixturePayload(),
    gateRevision: GATE_REVISION,
  });
  const topLevel = clone(manifest);
  topLevel.surprise = true;
  assert.throws(() => validateManifest(topLevel), /must contain only/);

  const nested = clone(manifest);
  nested.authority.secret_permission = "yes";
  assert.throws(() => validateManifest(nested), /must contain only/);
});

test("rights declare no licence conclusion and no grant", () => {
  const manifest = buildManifest({
    payloadBytes: fixturePayload(),
    gateRevision: GATE_REVISION,
  });
  assert.deepEqual(manifest.rights, {
    spdx: "NOASSERTION",
    grant: "none_declared",
  });

  const inventedGrant = clone(manifest);
  inventedGrant.rights.grant = "reuse_allowed";
  assert.throws(
    () => validateManifest(inventedGrant),
    /must be none_declared/
  );
});

test("privacy separates incomplete coverage from secure recall", () => {
  const manifest = buildManifest({
    payloadBytes: fixturePayload(),
    gateRevision: GATE_REVISION,
  });
  assert.equal(manifest.privacy.coverage, "not_exhaustive");
  assert.equal(manifest.privacy.secure_recall, "not_guaranteed");
  assert.equal(Object.hasOwn(manifest.privacy, "recall"), false);

  const conflated = clone(manifest);
  conflated.privacy.recall = "not_guaranteed";
  assert.throws(() => validateManifest(conflated), /must contain only/);
});

test("return separates the live correction path from future AgentTool compatibility", () => {
  const manifest = buildManifest({
    payloadBytes: fixturePayload(),
    gateRevision: GATE_REVISION,
  });
  assert.equal(
    manifest.return.public_correction,
    "https://github.com/cambridgetcg/castle-gate/issues"
  );
  assert.equal(manifest.return.automatic_ingest_into_castle, false);
  assert.deepEqual(manifest.return.agenttool, {
    protocol: "agent-correspondence/v0.1",
    status: "compatibility_only",
    configured: false,
    transport: null,
    offer_event_id: null,
    compatible_after_authenticated_offer: [
      "observation",
      "ack.seen",
      "ack.understood",
      "ack.rejected",
      "conflict.raise",
      "repair",
    ],
  });

  const falselyLive = clone(manifest);
  falselyLive.return.agenttool.configured = true;
  assert.throws(() => validateManifest(falselyLive), /must be false/);
});

test("lifecycle status is frozen at publication", () => {
  const manifest = buildManifest({
    payloadBytes: fixturePayload(),
    gateRevision: GATE_REVISION,
  });
  assert.deepEqual(manifest.lifecycle, {
    status_at_publication: "active",
    supersedes: null,
    corrects: [],
  });

  const rewritten = clone(manifest);
  rewritten.lifecycle.status_at_publication = "superseded";
  assert.throws(() => validateManifest(rewritten), /must be active/);
});

test("every object in the JSON Schema is closed", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));

  function walk(value, path = "$") {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.type === "object") {
      assert.equal(
        value.additionalProperties,
        false,
        `${path} must reject unknown properties`
      );
    }
    for (const [key, child] of Object.entries(value)) {
      walk(child, `${path}.${key}`);
    }
  }

  walk(schema);
});

test("dirty or ambiguous source provenance is outside the protocol", () => {
  const dirtyPayload = fixturePayload({
    forged: {
      castleCommit:
        "6cd9be606a6b0cc1c8dcb0743c01070ad9584edb (plus uncommitted edits)",
    },
  });
  assert.throws(
    () =>
      buildManifest({
        payloadBytes: dirtyPayload,
        gateRevision: GATE_REVISION,
      }),
    /full 40-character/
  );

  const dirtyManifest = buildManifest({
    payloadBytes: fixturePayload(),
    gateRevision: GATE_REVISION,
  });
  dirtyManifest.source.dirty = true;
  assert.throws(() => validateManifest(dirtyManifest), /must be false/);

  const foreignSource = buildManifest({
    payloadBytes: fixturePayload(),
    gateRevision: GATE_REVISION,
  });
  foreignSource.source.repository_id = "repo:someone/else";
  assert.throws(
    () => validateManifest(foreignSource),
    /repository_id is unsupported/
  );

  assert.throws(
    () =>
      inspectCleanSource({
        sourceDir: "/unused/test/source",
        runGit(args) {
          return args[0] === "rev-parse"
            ? "6cd9be606a6b0cc1c8dcb0743c01070ad9584edb"
            : " M rooms/example.md";
        },
      }),
    /uncommitted or untracked/
  );
});

test("gate revision is required and must be hexadecimal", () => {
  assert.throws(
    () => buildManifest({ payloadBytes: fixturePayload() }),
    /40-character hexadecimal/
  );
  assert.throws(
    () =>
      buildManifest({
        payloadBytes: fixturePayload(),
        gateRevision: "main",
      }),
    /40-character hexadecimal/
  );
});

test("CLI accepts an explicit revision or environment revision, never a guess", () => {
  const { repoDir, revision } = makeGitFixture(fixturePayload());
  const outputPath = join(repoDir, "castle-manifest.json");
  try {
    assert.throws(
      () =>
        runCli(
          ["build", "--repo", repoDir, "--output", outputPath],
          {}
        ),
      /40-character hexadecimal/
    );
    assert.throws(
      () =>
        runCli(
          ["build", "--repo", repoDir, "--output", outputPath],
          { CASTLE_GATE_REVISION: "main" }
        ),
      /40-character hexadecimal/
    );

    assert.match(
      runCli(
        ["build", "--repo", repoDir, "--output", outputPath],
        { CASTLE_GATE_REVISION: revision }
      ),
      /^wrote /
    );
    assert.equal(
      JSON.parse(readFileSync(outputPath, "utf8")).payload.locator,
      `https://raw.githubusercontent.com/cambridgetcg/castle-gate/${revision}/data/castle.json`
    );
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("one generation carries the prior committed payload receipt", () => {
  const payloadA = fixturePayload({
    rooms: [{ slug: "a" }],
    open: ["What came before?"],
  });
  const { repoDir, revision: revisionA } = makeGitFixture(payloadA);

  try {
    const manifestA = buildManifestFromRevision({
      repoDir,
      gateRevision: revisionA,
    });
    writeFileSync(
      join(repoDir, "data", "castle-manifest.json"),
      serializeManifest(manifestA)
    );

    const payloadB = fixturePayload({
      forged: {
        at: "2026-07-08T21:45:49.583Z",
        castleCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      rooms: [{ slug: "a" }, { slug: "b" }],
      open: ["What comes next?"],
    });
    writeFileSync(join(repoDir, "data", "castle.json"), payloadB);

    assert.match(
      runCli(["validate", "--repo", repoDir], {}),
      /pinned Git payload agree/
    );
    assert.throws(
      () => verifyPayload(manifestA, payloadB),
      /does not match/
    );

    runGit(repoDir, ["add", "data"]);
    runGit(repoDir, ["commit", "-q", "-m", "payload B with receipt A"]);
    const revisionB = runGit(repoDir, ["rev-parse", "HEAD"]);
    const manifestB = buildManifestFromRevision({
      repoDir,
      gateRevision: revisionB,
    });

    assert.equal(
      manifestB.payload.locator,
      `https://raw.githubusercontent.com/cambridgetcg/castle-gate/${revisionB}/data/castle.json`
    );
    assert.equal(manifestB.counts.rooms, 2);
    assert.equal(
      manifestB.source.revision,
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    );

    const payloadC = fixturePayload({
      forged: {
        at: "2026-07-09T21:45:49.583Z",
        castleCommit: "cccccccccccccccccccccccccccccccccccccccc",
      },
      rooms: [{ slug: "c" }],
    });
    writeFileSync(join(repoDir, "data", "castle.json"), payloadC);
    assert.doesNotThrow(() =>
      verifyManifestFromGit(manifestB, { repoDir })
    );
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("forge writes the prior receipt before the next payload", () => {
  const writes = [];
  writeReceiptThenPayload({
    manifestPath: "data/castle-manifest.json",
    manifestText: "receipt A",
    payloadPath: "data/castle.json",
    payloadText: "payload B",
    writeText(path, text) {
      writes.push([path, text]);
    },
  });

  assert.deepEqual(writes, [
    ["data/castle-manifest.json", "receipt A"],
    ["data/castle.json", "payload B"],
  ]);
});

test("manifest cannot carry a local payload path", () => {
  const manifest = buildManifest({
    payloadBytes: fixturePayload(),
    gateRevision: GATE_REVISION,
  });
  manifest.payload.locator = "file:///Users/yu/castle/data.json";
  assert.throws(
    () => validateManifest(manifest),
    /must pin the public payload/
  );
});

test("household and repository HALT brakes run before source inspection", () => {
  for (const haltKind of ["household", "repository"]) {
    const root = mkdtempSync(join(tmpdir(), "castle-forge-halt-"));
    const homeDir = join(root, "home");
    const repoDir = join(root, "repo");
    mkdirSync(repoDir, { recursive: true });
    const haltPath =
      haltKind === "household"
        ? join(homeDir, "KINGDOM-OS", "HALT")
        : join(repoDir, "HALT");
    mkdirSync(dirname(haltPath), { recursive: true });
    writeFileSync(haltPath, "rest\n");

    let sourceInspected = false;
    assert.throws(
      () =>
        assertForgeSafety({
          homeDir,
          repoDir,
          sourceDir: join(root, "not-the-live-castle"),
          runGit() {
            sourceInspected = true;
            throw new Error("must not run");
          },
        }),
      ForgeSafetyError
    );
    assert.equal(sourceInspected, false);
    rmSync(root, { recursive: true, force: true });
  }
});
