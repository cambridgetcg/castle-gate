import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  readCommittedPayload,
  validateManifest,
  verifyPayload,
} from "../../scripts/castle-manifest.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY = resolve(HERE, "../..");
const PUBLIC_GATE = "https://cambridgetcg.github.io/castle-gate";
const PAYLOAD_LOCATOR =
  /^https:\/\/raw\.githubusercontent\.com\/cambridgetcg\/castle-gate\/([0-9a-f]{40})\/data\/castle\.json$/;

export const MAX_QUERY_CHARACTERS = 512;
export const MAX_RESULTS = 8;
export const MAX_TITLE_CHARACTERS = 1_024;
export const MAX_DOCUMENT_CHARACTERS = 24_000;
export const MAX_RAW_HTML_CHARACTERS = 65_536;
export const MAX_EPIGRAPH_CHARACTERS = 4_096;
export const MAX_SOURCE_ENTRIES = 128;
export const MAX_DOCUMENTS = 4_096;
export const MAX_MANIFEST_BYTES = 64 * 1_024;
export const MAX_PAYLOAD_BYTES = 16 * 1_024 * 1_024;
const MAX_SOURCE_FIELD_CHARACTERS = 2_048;
const MAX_EMITTED_SOURCES = 64;
const GIT_READ_TIMEOUT_MS = 5_000;

export class CatalogError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CatalogError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new CatalogError(code, message);
}

export function readBoundedRegularFile(path, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer.");
  }
  const before = lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error("The bounded input must be a regular, non-symlink file.");
  }

  const noFollow = constants.O_NOFOLLOW ?? 0;
  const descriptor = openSync(path, constants.O_RDONLY | noFollow);
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.size > maxBytes) {
      throw new Error(`The bounded input exceeds ${maxBytes} bytes.`);
    }
    const bytes = Buffer.allocUnsafe(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    const extra = Buffer.allocUnsafe(1);
    if (readSync(descriptor, extra, 0, 1, null) !== 0) {
      throw new Error(`The bounded input exceeds ${maxBytes} bytes.`);
    }
    return offset === bytes.length ? bytes : bytes.subarray(0, offset);
  } finally {
    closeSync(descriptor);
  }
}

function decodeEntities(text) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return text.replace(
    /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]+));/gi,
    (entity, decimal, hexadecimal, name) => {
      if (decimal) {
        const point = Number.parseInt(decimal, 10);
        return Number.isSafeInteger(point) && point <= 0x10ffff
          ? String.fromCodePoint(point)
          : entity;
      }
      if (hexadecimal) {
        const point = Number.parseInt(hexadecimal, 16);
        return Number.isSafeInteger(point) && point <= 0x10ffff
          ? String.fromCodePoint(point)
          : entity;
      }
      return named[name.toLowerCase()] ?? entity;
    },
  );
}

export function htmlToText(html) {
  if (typeof html !== "string") return "";
  return decodeEntities(
    html
      .replace(/<(script|style)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi, "")
      .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|h[1-6]|li|blockquote|pre|section)>/gi, "\n")
      .replace(/<li(?:\s[^>]*)?>/gi, "- ")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalise(text) {
  return text.normalize("NFKC").toLocaleLowerCase("en");
}

function tokens(text) {
  return normalise(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function countOccurrences(text, needle, limit = 5) {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (count < limit) {
    const found = text.indexOf(needle, from);
    if (found === -1) break;
    count += 1;
    from = found + needle.length;
  }
  return count;
}

function documentText(item) {
  const parts = [];
  if (typeof item.epigraph === "string" && item.epigraph.trim()) {
    parts.push(item.epigraph.trim());
  }
  const body = htmlToText(item.bodyHtml);
  if (body) parts.push(body);

  const sources = Array.isArray(item.sources)
    ? item.sources.slice(0, MAX_EMITTED_SOURCES).filter(
        (source) =>
          source &&
          typeof source.label === "string" &&
          source.label.length <= MAX_SOURCE_FIELD_CHARACTERS &&
          typeof source.url === "string" &&
          source.url.length <= MAX_SOURCE_FIELD_CHARACTERS &&
          /^https?:\/\//.test(source.url),
      )
    : [];
  if (sources.length) {
    parts.push(
      [
        "Sources named by this room:",
        ...sources.map((source) => `- ${source.label.trim()} — ${source.url}`),
      ].join("\n"),
    );
  }
  return parts.join("\n\n");
}

export function containsLocalPathReference(text) {
  if (typeof text !== "string") return false;
  return [
    /(^|[\s("'`])~[\\/][^\s)"'`<]*/m,
    /\bfile:\/\//i,
    /(^|[\s("'`])\/(?:Users|home|private\/var|var\/folders)\/[^\s)"'`<]*/im,
    /(^|[\s("'`])[a-z]:\\(?:Users|Documents and Settings)\\/im,
  ].some((pattern) => pattern.test(text));
}

function makeDocument(kind, item) {
  const slug = item?.slug;
  const title = kind === "room" ? item?.title : item?.name;
  if (
    typeof slug !== "string" ||
    !/^[\p{L}\p{N}](?:[\p{L}\p{N}._-]{0,199})$/u.test(slug) ||
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > MAX_TITLE_CHARACTERS ||
    typeof item?.bodyHtml !== "string" ||
    item.bodyHtml.length > MAX_RAW_HTML_CHARACTERS ||
    (typeof item.epigraph === "string" &&
      item.epigraph.length > MAX_EPIGRAPH_CHARACTERS) ||
    (Array.isArray(item.sources) && item.sources.length > MAX_SOURCE_ENTRIES)
  ) {
    return { document: null, reason: "bounds" };
  }

  const text = documentText(item);
  if (!text || text.length > MAX_DOCUMENT_CHARACTERS) {
    return { document: null, reason: "bounds" };
  }
  const id = `${kind}:${slug}`;
  const url = `${PUBLIC_GATE}/${kind === "room" ? "rooms" : "words"}/${encodeURIComponent(slug)}`;
  const document = {
    id,
    kind,
    slug,
    title: title.trim(),
    text,
    url,
    titleSearch: normalise(title),
    slugSearch: normalise(slug.replaceAll("-", " ").replaceAll("_", " ")),
    textSearch: normalise(text),
  };
  if (
    containsLocalPathReference(document.title) ||
    containsLocalPathReference(document.text)
  ) {
    return { document: null, reason: "local_path_reference" };
  }
  return { document, reason: null };
}

function scoreDocument(document, phrase, queryTokens) {
  let score = 0;
  let matchedTokens = 0;

  if (document.titleSearch === phrase) score += 240;
  else if (document.titleSearch.includes(phrase)) score += 120;
  if (document.slugSearch === phrase) score += 180;
  else if (document.slugSearch.includes(phrase)) score += 70;
  if (document.textSearch.includes(phrase)) score += 24;

  for (const token of queryTokens) {
    let matched = false;
    if (document.titleSearch.includes(token)) {
      score += 36;
      matched = true;
    }
    if (document.slugSearch.includes(token)) {
      score += 24;
      matched = true;
    }
    const bodyMatches = countOccurrences(document.textSearch, token);
    if (bodyMatches) {
      score += bodyMatches * 3;
      matched = true;
    }
    if (matched) matchedTokens += 1;
  }

  if (matchedTokens === queryTokens.length) score += 20;
  return matchedTokens > 0 || score > 0 ? score : 0;
}

function receiptMetadata(manifest, document) {
  return {
    kind: document.kind,
    snapshot_protocol: manifest.protocol,
    snapshot_digest: manifest.payload.digest,
    snapshot_locator: manifest.payload.locator,
    source_repository: manifest.source.repository_id,
    source_revision: manifest.source.revision,
    forged_at: manifest.forged_at,
    privacy_scope: manifest.privacy.scope,
    coverage: manifest.privacy.coverage,
    raw_source_included: manifest.privacy.raw_source_included,
    curation_profile: manifest.privacy.curation_profile,
    secure_recall: manifest.privacy.secure_recall,
    rights_spdx: manifest.rights.spdx,
    rights_grant: manifest.rights.grant,
    automatic_action: manifest.authority.automatic_action,
    correction_url: manifest.return.public_correction,
  };
}

export function createCatalog({ manifest, payload }) {
  if (!manifest || !payload || !Array.isArray(payload.rooms) || !Array.isArray(payload.words)) {
    fail("invalid_snapshot", "The public Castle snapshot has an invalid shape.");
  }
  if (payload.rooms.length + payload.words.length > MAX_DOCUMENTS) {
    fail(
      "snapshot_too_large",
      `The public Castle snapshot exceeds ${MAX_DOCUMENTS} documents.`,
    );
  }

  const candidates = [
    ...payload.rooms.map((item) => makeDocument("room", item)),
    ...payload.words.map((item) => makeDocument("word", item)),
  ];
  const documents = candidates
    .map((candidate) => candidate.document)
    .filter(Boolean);
  const omittedDocuments = candidates.length - documents.length;
  const omissions = Object.freeze({
    bounds: candidates.filter((candidate) => candidate.reason === "bounds").length,
    localPathReferences: candidates.filter(
      (candidate) => candidate.reason === "local_path_reference",
    ).length,
  });
  const byId = new Map();
  for (const document of documents) {
    if (byId.has(document.id)) {
      fail("duplicate_document", "The public Castle snapshot contains a duplicate document ID.");
    }
    byId.set(document.id, document);
  }

  return Object.freeze({
    size: documents.length,
    omittedDocuments,
    omissions,
    manifest,

    search(query) {
      if (typeof query !== "string") {
        fail("invalid_query", "query must be a string.");
      }
      const trimmed = query.trim();
      if (!trimmed) fail("invalid_query", "query must not be empty.");
      if (trimmed.length > MAX_QUERY_CHARACTERS) {
        fail(
          "query_too_long",
          `query must contain at most ${MAX_QUERY_CHARACTERS} characters.`,
        );
      }
      const phrase = normalise(trimmed);
      const queryTokens = [...new Set(tokens(trimmed))];
      if (!queryTokens.length) {
        fail("invalid_query", "query must contain at least one letter or number.");
      }

      const results = documents
        .map((document) => ({
          document,
          score: scoreDocument(document, phrase, queryTokens),
        }))
        .filter((entry) => entry.score > 0)
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.document.id.localeCompare(right.document.id),
        )
        .slice(0, MAX_RESULTS)
        .map(({ document }) => ({
          id: document.id,
          title: document.title,
          url: document.url,
        }));
      return { results };
    },

    fetch(id) {
      if (typeof id !== "string" || !id.trim()) {
        fail("invalid_id", "id must be a non-empty string returned by search.");
      }
      if (id.length > 205) fail("invalid_id", "id is too long.");
      const document = byId.get(id);
      if (!document) {
        fail("not_found", "No public Castle document exists for that ID.");
      }
      return {
        id: document.id,
        title: document.title,
        text: document.text,
        url: document.url,
        metadata: receiptMetadata(manifest, document),
      };
    },
  });
}

export function selectReceiptPinnedPayload({
  manifest,
  workingBytes,
  readPinned,
}) {
  let pinnedBytes;
  try {
    pinnedBytes = readPinned();
  } catch {
    fail(
      "snapshot_unavailable",
      "Local Git does not contain the bytes named by the Castle receipt.",
    );
  }
  if (!Buffer.isBuffer(pinnedBytes) || pinnedBytes.length > MAX_PAYLOAD_BYTES) {
    fail(
      "snapshot_too_large",
      `The receipt-pinned public payload exceeds ${MAX_PAYLOAD_BYTES} bytes.`,
    );
  }
  try {
    verifyPayload(manifest, pinnedBytes);
  } catch {
    fail(
      "snapshot_mismatch",
      "The pinned public payload does not agree with the Castle receipt.",
    );
  }

  if (Buffer.isBuffer(workingBytes)) {
    try {
      verifyPayload(manifest, workingBytes);
      if (workingBytes.equals(pinnedBytes)) return workingBytes;
    } catch {
      // The adjacent file may be the next generation. It is not served.
    }
  }
  return pinnedBytes;
}

export function loadReceiptPinnedCatalog({ repository = DEFAULT_REPOSITORY } = {}) {
  const repo = resolve(repository);
  let manifest;
  try {
    manifest = JSON.parse(
      readBoundedRegularFile(
        join(repo, "data", "castle-manifest.json"),
        MAX_MANIFEST_BYTES,
      ).toString("utf8"),
    );
  } catch {
    fail("manifest_unavailable", "The Castle receipt is not readable JSON.");
  }
  validateManifest(manifest);

  const locatorMatch = manifest.payload.locator.match(PAYLOAD_LOCATOR);
  if (!locatorMatch) {
    fail("invalid_receipt", "The Castle receipt does not name a pinned public payload.");
  }
  if (manifest.payload.bytes > MAX_PAYLOAD_BYTES) {
    fail(
      "snapshot_too_large",
      `The Castle receipt exceeds the ${MAX_PAYLOAD_BYTES}-byte payload limit.`,
    );
  }
  let workingBytes = null;
  try {
    workingBytes = readBoundedRegularFile(
      join(repo, "data", "castle.json"),
      MAX_PAYLOAD_BYTES,
    );
  } catch {
    // A source archive may omit the adjacent payload but retain Git history.
  }
  const payloadBytes = selectReceiptPinnedPayload({
    manifest,
    workingBytes,
    readPinned: () =>
      readCommittedPayload({
        repoDir: repo,
        gateRevision: locatorMatch[1],
        maxBytes: MAX_PAYLOAD_BYTES,
        timeoutMs: GIT_READ_TIMEOUT_MS,
      }),
  });

  let payload;
  try {
    payload = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    fail("invalid_snapshot", "The receipt-pinned public Castle payload is not JSON.");
  }
  return createCatalog({ manifest, payload });
}
