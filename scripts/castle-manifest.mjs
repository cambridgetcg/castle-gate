#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteText } from "./forge-safety.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const PAYLOAD_REPO_PATH = "data/castle.json";
const PAYLOAD_LOCATOR_RE =
  /^https:\/\/raw\.githubusercontent\.com\/cambridgetcg\/castle-gate\/([0-9a-f]{40})\/data\/castle\.json$/;
const MANIFEST_LOCATOR_RE =
  /^https:\/\/raw\.githubusercontent\.com\/cambridgetcg\/castle-gate\/[0-9a-f]{40}\/data\/castle-manifest\.json$/;

export const SCHEMA_URL =
  "../schema/castle-understanding-manifest.schema.json";
export const PROTOCOL = "castle-understanding/v0.1";
export const RETURN_PROTOCOL = "agent-correspondence/v0.1";
export const SOURCE_REPOSITORY = "repo:cambridgetcg/castle-of-words";
export const PAYLOAD_SHAPE = "castle-gate/castle-data/v1";
export const COMPATIBLE_RETURN_KINDS = Object.freeze([
  "observation",
  "ack.seen",
  "ack.understood",
  "ack.rejected",
  "conflict.raise",
  "repair",
]);

export class ManifestError extends Error {
  constructor(message) {
    super(message);
    this.name = "ManifestError";
  }
}

function fail(message) {
  throw new ManifestError(message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertRecord(value, path) {
  if (!isRecord(value)) fail(`${path} must be an object`);
}

function assertExactKeys(value, keys, path) {
  assertRecord(value, path);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(`${path} must contain only: ${expected.join(", ")}`);
  }
}

function assertInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(`${path} must be a non-negative safe integer`);
  }
}

function assertIsoDate(value, path) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    ) ||
    Number.isNaN(Date.parse(value))
  ) {
    fail(`${path} must be an ISO date-time string`);
  }
}

function normalizeRevision(value, path) {
  if (typeof value !== "string" || !/^[0-9a-fA-F]{40}$/.test(value)) {
    fail(`${path} must be a full 40-character hexadecimal Git revision`);
  }
  return value.toLowerCase();
}

function parsePayload(payloadBytes) {
  let payload;
  try {
    payload = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    fail("payload must be valid JSON");
  }

  assertRecord(payload, "payload");
  assertRecord(payload.forged, "payload.forged");
  assertIsoDate(payload.forged.at, "payload.forged.at");
  const sourceRevision = normalizeRevision(
    payload.forged.castleCommit,
    "payload.forged.castleCommit"
  );

  if (!Array.isArray(payload.rooms)) fail("payload.rooms must be an array");
  if (!Array.isArray(payload.words)) fail("payload.words must be an array");
  assertRecord(payload.questions, "payload.questions");
  if (!Array.isArray(payload.questions.open)) {
    fail("payload.questions.open must be an array");
  }
  if (!Array.isArray(payload.questions.settled)) {
    fail("payload.questions.settled must be an array");
  }

  return {
    parsed: payload,
    sourceRevision,
  };
}

function digestPayload(payloadBytes) {
  return `sha256:${createHash("sha256").update(payloadBytes).digest("hex")}`;
}

function defaultReadGitFile(
  repoDir,
  revision,
  repoPath,
  { maxBuffer = 32 * 1024 * 1024, timeout } = {}
) {
  const options = {
    cwd: repoDir,
    encoding: null,
    maxBuffer,
    stdio: ["ignore", "pipe", "pipe"],
  };
  if (timeout !== undefined) options.timeout = timeout;
  return execFileSync("git", ["show", `${revision}:${repoPath}`], options);
}

export function readCommittedPayload({
  repoDir = REPO,
  gateRevision,
  readGitFile = defaultReadGitFile,
  maxBytes = 32 * 1024 * 1024,
  timeoutMs,
}) {
  const revision = normalizeRevision(gateRevision, "gate revision");
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    fail("maxBytes must be a positive safe integer");
  }
  if (
    timeoutMs !== undefined &&
    (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
  ) {
    fail("timeoutMs must be a positive safe integer");
  }
  let payloadBytes;
  try {
    payloadBytes = readGitFile(repoDir, revision, PAYLOAD_REPO_PATH, {
      maxBuffer: maxBytes + 1024,
      timeout: timeoutMs,
    });
  } catch {
    fail("the chosen Gate commit does not contain data/castle.json");
  }
  if (!Buffer.isBuffer(payloadBytes)) {
    payloadBytes = Buffer.from(payloadBytes);
  }
  if (payloadBytes.length > maxBytes) {
    fail(`committed payload exceeds the ${maxBytes}-byte read limit`);
  }
  return payloadBytes;
}

export function buildManifestFromRevision({
  repoDir = REPO,
  gateRevision,
  readGitFile = defaultReadGitFile,
}) {
  const payloadBytes = readCommittedPayload({
    repoDir,
    gateRevision,
    readGitFile,
  });
  return buildManifest({ payloadBytes, gateRevision });
}

export function buildManifest({ payloadBytes, gateRevision }) {
  if (!Buffer.isBuffer(payloadBytes)) {
    fail("payloadBytes must be a Buffer");
  }
  const normalizedGateRevision = normalizeRevision(
    gateRevision,
    "gate revision"
  );
  const { parsed, sourceRevision } = parsePayload(payloadBytes);

  const manifest = {
    $schema: SCHEMA_URL,
    protocol: PROTOCOL,
    kind: "curated_snapshot",
    forged_at: parsed.forged.at,
    source: {
      repository_id: SOURCE_REPOSITORY,
      revision: sourceRevision,
      dirty: false,
    },
    payload: {
      media_type: "application/json",
      digest: digestPayload(payloadBytes),
      bytes: payloadBytes.length,
      locator:
        "https://raw.githubusercontent.com/cambridgetcg/castle-gate/" +
        `${normalizedGateRevision}/data/castle.json`,
      shape: PAYLOAD_SHAPE,
    },
    counts: {
      rooms: parsed.rooms.length,
      words: parsed.words.length,
      open_questions: parsed.questions.open.length,
      settled_questions: parsed.questions.settled.length,
    },
    privacy: {
      scope: "public_curated",
      raw_source_included: false,
      curation_profile: "castle-gate-public/v1",
      coverage: "not_exhaustive",
      secure_recall: "not_guaranteed",
    },
    authority: {
      automatic_action: "never",
      grants: [],
    },
    rights: {
      spdx: "NOASSERTION",
      grant: "none_declared",
    },
    return: {
      public_correction:
        "https://github.com/cambridgetcg/castle-gate/issues",
      automatic_ingest_into_castle: false,
      agenttool: {
        protocol: RETURN_PROTOCOL,
        status: "compatibility_only",
        configured: false,
        transport: null,
        offer_event_id: null,
        compatible_after_authenticated_offer: [
          ...COMPATIBLE_RETURN_KINDS,
        ],
      },
    },
    lifecycle: {
      status_at_publication: "active",
      supersedes: null,
      corrects: [],
    },
    compatibility: {
      agenttool_sdk: "0.16.0",
      mode: "metadata_only",
    },
  };

  validateManifest(manifest);
  verifyPayload(manifest, payloadBytes);
  return manifest;
}

export function validateManifest(manifest) {
  assertExactKeys(
    manifest,
    [
      "$schema",
      "protocol",
      "kind",
      "forged_at",
      "source",
      "payload",
      "counts",
      "privacy",
      "authority",
      "rights",
      "return",
      "lifecycle",
      "compatibility",
    ],
    "manifest"
  );
  if (manifest.$schema !== SCHEMA_URL) fail("manifest.$schema is unsupported");
  if (manifest.protocol !== PROTOCOL) fail("manifest.protocol is unsupported");
  if (manifest.kind !== "curated_snapshot") {
    fail("manifest.kind must be curated_snapshot");
  }
  assertIsoDate(manifest.forged_at, "manifest.forged_at");

  assertExactKeys(
    manifest.source,
    ["repository_id", "revision", "dirty"],
    "manifest.source"
  );
  if (manifest.source.repository_id !== SOURCE_REPOSITORY) {
    fail("manifest.source.repository_id is unsupported");
  }
  normalizeRevision(manifest.source.revision, "manifest.source.revision");
  if (manifest.source.dirty !== false) {
    fail("manifest.source.dirty must be false");
  }

  assertExactKeys(
    manifest.payload,
    ["media_type", "digest", "bytes", "locator", "shape"],
    "manifest.payload"
  );
  if (manifest.payload.media_type !== "application/json") {
    fail("manifest.payload.media_type must be application/json");
  }
  if (
    typeof manifest.payload.digest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/.test(manifest.payload.digest)
  ) {
    fail("manifest.payload.digest must be a sha256 digest");
  }
  assertInteger(manifest.payload.bytes, "manifest.payload.bytes");
  if (manifest.payload.bytes === 0) {
    fail("manifest.payload.bytes must be greater than zero");
  }
  if (
    typeof manifest.payload.locator !== "string" ||
    !PAYLOAD_LOCATOR_RE.test(manifest.payload.locator)
  ) {
    fail("manifest.payload.locator must pin the public payload to a Git commit");
  }
  if (manifest.payload.shape !== PAYLOAD_SHAPE) {
    fail("manifest.payload.shape is unsupported");
  }

  assertExactKeys(
    manifest.counts,
    ["rooms", "words", "open_questions", "settled_questions"],
    "manifest.counts"
  );
  for (const key of [
    "rooms",
    "words",
    "open_questions",
    "settled_questions",
  ]) {
    assertInteger(manifest.counts[key], `manifest.counts.${key}`);
  }

  assertExactKeys(
    manifest.privacy,
    [
      "scope",
      "raw_source_included",
      "curation_profile",
      "coverage",
      "secure_recall",
    ],
    "manifest.privacy"
  );
  if (manifest.privacy.scope !== "public_curated") {
    fail("manifest.privacy.scope must be public_curated");
  }
  if (manifest.privacy.raw_source_included !== false) {
    fail("manifest.privacy.raw_source_included must be false");
  }
  if (manifest.privacy.curation_profile !== "castle-gate-public/v1") {
    fail("manifest.privacy.curation_profile is unsupported");
  }
  if (manifest.privacy.coverage !== "not_exhaustive") {
    fail("manifest.privacy.coverage must be not_exhaustive");
  }
  if (manifest.privacy.secure_recall !== "not_guaranteed") {
    fail("manifest.privacy.secure_recall must be not_guaranteed");
  }

  assertExactKeys(
    manifest.authority,
    ["automatic_action", "grants"],
    "manifest.authority"
  );
  if (manifest.authority.automatic_action !== "never") {
    fail("manifest.authority.automatic_action must be never");
  }
  if (!Array.isArray(manifest.authority.grants) || manifest.authority.grants.length) {
    fail("manifest.authority.grants must be an empty array");
  }

  assertExactKeys(manifest.rights, ["spdx", "grant"], "manifest.rights");
  if (manifest.rights.spdx !== "NOASSERTION") {
    fail("manifest.rights.spdx must be NOASSERTION");
  }
  if (manifest.rights.grant !== "none_declared") {
    fail("manifest.rights.grant must be none_declared");
  }

  assertExactKeys(
    manifest.return,
    ["public_correction", "automatic_ingest_into_castle", "agenttool"],
    "manifest.return"
  );
  if (
    manifest.return.public_correction !==
    "https://github.com/cambridgetcg/castle-gate/issues"
  ) {
    fail("manifest.return.public_correction is unsupported");
  }
  if (manifest.return.automatic_ingest_into_castle !== false) {
    fail("manifest.return.automatic_ingest_into_castle must be false");
  }
  assertExactKeys(
    manifest.return.agenttool,
    [
      "protocol",
      "status",
      "configured",
      "transport",
      "offer_event_id",
      "compatible_after_authenticated_offer",
    ],
    "manifest.return.agenttool"
  );
  if (manifest.return.agenttool.protocol !== RETURN_PROTOCOL) {
    fail("manifest.return.agenttool.protocol is unsupported");
  }
  if (manifest.return.agenttool.status !== "compatibility_only") {
    fail("manifest.return.agenttool.status must be compatibility_only");
  }
  if (manifest.return.agenttool.configured !== false) {
    fail("manifest.return.agenttool.configured must be false");
  }
  if (manifest.return.agenttool.transport !== null) {
    fail("manifest.return.agenttool.transport must be null");
  }
  if (manifest.return.agenttool.offer_event_id !== null) {
    fail("manifest.return.agenttool.offer_event_id must be null");
  }
  if (
    !Array.isArray(
      manifest.return.agenttool.compatible_after_authenticated_offer
    ) ||
    manifest.return.agenttool.compatible_after_authenticated_offer.length !==
      COMPATIBLE_RETURN_KINDS.length ||
    manifest.return.agenttool.compatible_after_authenticated_offer.some(
      (kind, index) => kind !== COMPATIBLE_RETURN_KINDS[index]
    )
  ) {
    fail(
      "manifest.return.agenttool.compatible_after_authenticated_offer " +
        "must match the protocol list"
    );
  }

  assertExactKeys(
    manifest.lifecycle,
    ["status_at_publication", "supersedes", "corrects"],
    "manifest.lifecycle"
  );
  if (manifest.lifecycle.status_at_publication !== "active") {
    fail("manifest.lifecycle.status_at_publication must be active");
  }
  if (
    manifest.lifecycle.supersedes !== null &&
    (typeof manifest.lifecycle.supersedes !== "string" ||
      !MANIFEST_LOCATOR_RE.test(manifest.lifecycle.supersedes))
  ) {
    fail(
      "manifest.lifecycle.supersedes must be null or a commit-pinned receipt"
    );
  }
  if (
    !Array.isArray(manifest.lifecycle.corrects) ||
    manifest.lifecycle.corrects.some(
      (locator) =>
        typeof locator !== "string" || !MANIFEST_LOCATOR_RE.test(locator)
    ) ||
    new Set(manifest.lifecycle.corrects).size !==
      manifest.lifecycle.corrects.length
  ) {
    fail(
      "manifest.lifecycle.corrects must contain unique commit-pinned receipts"
    );
  }

  assertExactKeys(
    manifest.compatibility,
    ["agenttool_sdk", "mode"],
    "manifest.compatibility"
  );
  if (manifest.compatibility.agenttool_sdk !== "0.16.0") {
    fail("manifest.compatibility.agenttool_sdk is unsupported");
  }
  if (manifest.compatibility.mode !== "metadata_only") {
    fail("manifest.compatibility.mode must be metadata_only");
  }

  const serialized = JSON.stringify(manifest);
  if (
    serialized.includes("/Users/") ||
    serialized.includes("file://") ||
    serialized.includes("~/")
  ) {
    fail("manifest must not contain local filesystem paths");
  }
  return manifest;
}

export function verifyPayload(manifest, payloadBytes) {
  validateManifest(manifest);
  if (!Buffer.isBuffer(payloadBytes)) fail("payloadBytes must be a Buffer");
  const { parsed, sourceRevision } = parsePayload(payloadBytes);

  if (manifest.payload.bytes !== payloadBytes.length) {
    fail("manifest payload byte count does not match");
  }
  if (manifest.payload.digest !== digestPayload(payloadBytes)) {
    fail("manifest payload digest does not match");
  }
  if (manifest.source.revision !== sourceRevision) {
    fail("manifest source revision does not match payload provenance");
  }
  if (manifest.forged_at !== parsed.forged.at) {
    fail("manifest forge time does not match payload provenance");
  }

  const expectedCounts = {
    rooms: parsed.rooms.length,
    words: parsed.words.length,
    open_questions: parsed.questions.open.length,
    settled_questions: parsed.questions.settled.length,
  };
  for (const [key, value] of Object.entries(expectedCounts)) {
    if (manifest.counts[key] !== value) {
      fail(`manifest count does not match payload: ${key}`);
    }
  }
  return manifest;
}

export function verifyManifestFromGit(
  manifest,
  {
    repoDir = REPO,
    readGitFile = defaultReadGitFile,
  } = {}
) {
  validateManifest(manifest);
  const match = manifest.payload.locator.match(PAYLOAD_LOCATOR_RE);
  if (!match) {
    fail("manifest payload locator does not contain a Gate revision");
  }
  const payloadBytes = readCommittedPayload({
    repoDir,
    gateRevision: match[1],
    readGitFile,
  });
  return verifyPayload(manifest, payloadBytes);
}

export function serializeManifest(manifest) {
  validateManifest(manifest);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function parseCli(args) {
  const command = args.shift();
  if (!["build", "validate"].includes(command)) {
    fail("usage: castle-manifest.mjs <build|validate> [options]");
  }

  const options = {};
  const booleans = new Set(["check"]);
  while (args.length) {
    const token = args.shift();
    if (!token.startsWith("--")) fail(`unexpected argument: ${token}`);
    const [rawName, inlineValue] = token.slice(2).split("=", 2);
    if (!["gate-revision", "repo", "output", "manifest", "check"].includes(rawName)) {
      fail(`unknown option: --${rawName}`);
    }
    if (Object.hasOwn(options, rawName)) {
      fail(`duplicate option: --${rawName}`);
    }
    if (booleans.has(rawName)) {
      if (inlineValue !== undefined) fail(`--${rawName} takes no value`);
      options[rawName] = true;
      continue;
    }
    const value = inlineValue ?? args.shift();
    if (!value || value.startsWith("--")) fail(`--${rawName} needs a value`);
    options[rawName] = value;
  }
  return { command, options };
}

export function runCli(args = process.argv.slice(2), env = process.env) {
  const { command, options } = parseCli([...args]);
  const repoDir = resolve(options.repo ?? REPO);

  if (command === "build") {
    if (options.manifest) {
      fail("build accepts --output, not --manifest");
    }
    const gateRevision =
      options["gate-revision"] ?? env.CASTLE_GATE_REVISION;
    const manifest = buildManifestFromRevision({
      repoDir,
      gateRevision,
    });
    const outputPath = resolve(
      options.output ?? join(repoDir, "data", "castle-manifest.json")
    );
    const serialized = serializeManifest(manifest);

    if (options.check) {
      const current = readFileSync(outputPath, "utf8");
      if (current !== serialized) {
        fail("checked-in manifest is not the deterministic build output");
      }
      return `manifest is current: ${outputPath}`;
    }

    atomicWriteText(outputPath, serialized);
    return `wrote ${outputPath}`;
  }

  if (options.output || options["gate-revision"] || options.check) {
    fail("validate accepts only --manifest and --repo");
  }
  const manifestPath = resolve(
    options.manifest ?? join(repoDir, "data", "castle-manifest.json")
  );
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    fail("manifest must be readable JSON");
  }
  verifyManifestFromGit(manifest, { repoDir });
  return `manifest and pinned Git payload agree: ${manifestPath}`;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    console.log(runCli());
  } catch (error) {
    console.error(
      `castle-manifest: ${
        error instanceof Error ? error.message : "unknown failure"
      }`
    );
    process.exitCode = 1;
  }
}
