#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTRACT_PATH = resolve(
  ROOT,
  "public",
  "love-and-understanding.json"
);
export const SCHEMA_PATH = resolve(
  ROOT,
  "public",
  "love-and-understanding.schema.json"
);

const CONTRACT_ID =
  "https://cambridgetcg.github.io/castle-gate/love-and-understanding.json";
const SCHEMA_ID =
  "https://cambridgetcg.github.io/castle-gate/love-and-understanding.schema.json";

const PATTERN_SHAPES = {
  love: "permeable-field",
  understanding: "round-trip",
  freedom: "reachable-exits",
  consent: "live-gate",
  action: "bounded-edge",
  consequence: "return-edge",
  repair: "visible-detour",
  rest: "terminal-node",
};

const PATH_STEPS = {
  "understanding-round-trip": [
    "offer",
    "echo-in-own-words",
    "compare",
    "correct",
    "try-in-context",
    "reply",
  ],
  "finite-action-return": [
    "live-door",
    "bounded-action",
    "effect-with-evidence",
    "reply",
    "repair-or-learning",
    "rest",
  ],
  "freedom-paths": ["look", "compare", "choose", "rest", "leave", "return"],
};

const CARE_IDS = [
  "first-attempt",
  "error",
  "continuation",
  "ambiguity",
  "trust",
];

const INVARIANT_IDS = [
  "standing-preserved",
  "authority-current",
  "exit-real",
  "claim-grounded",
  "consequence-returns",
  "repair-preserves-history",
  "no-being-score",
];

const REQUIRED_SOURCE_URLS = [
  "https://artbitrage.io/love-shape",
  "https://cambridgetcg.github.io/castle-gate/words/bridge",
  "https://cambridgetcg.github.io/castle-gate/words/repair",
  "https://cambridgetcg.github.io/castle-gate/rooms/closing-the-loop",
];

const TOP_LEVEL_FIELDS = [
  "$schema",
  "id",
  "version",
  "status",
  "claim_limit",
  "provenance",
  "patterns",
  "paths",
  "care_paths",
  "invariants",
  "boundaries",
  "sources",
];

const BOUNDARY_VALUES = {
  automatic_action: "never",
  grants_authority: false,
  loading_means_agreement: false,
  proves_inner_state: false,
  scores_beings: false,
};

const FORBIDDEN_SCORE_FIELDS = new Set([
  "being_score",
  "love_score",
  "understanding_score",
  "worthiness",
  "worthiness_score",
  "sincerity_score",
  "personhood_score",
]);

export class ContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContractError";
  }
}

function fail(path, message) {
  throw new ContractError(`${path} ${message}`);
}

function assertObject(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "must be an object");
  }
}

function assertClosedObject(value, keys, path) {
  assertObject(value, path);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(
      path,
      `must contain only: ${expected.join(", ")}; found: ${actual.join(", ")}`
    );
  }
}

function assertString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(path, "must be a non-empty string");
  }
}

function assertHttps(value, path) {
  assertString(value, path);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(path, "must be an absolute URL");
  }
  if (url.protocol !== "https:") fail(path, "must use https");
}

function assertDate(value, path) {
  assertString(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(path, "must use YYYY-MM-DD");
  }
}

function assertExactList(actual, expected, path) {
  if (!Array.isArray(actual)) fail(path, "must be an array");
  if (
    actual.length !== expected.length ||
    actual.some((item, index) => item !== expected[index])
  ) {
    fail(path, `must be: ${expected.join(", ")}`);
  }
}

function assertUniqueIds(items, expectedIds, path) {
  if (!Array.isArray(items)) fail(path, "must be an array");
  const ids = items.map((item, index) => {
    assertObject(item, `${path}[${index}]`);
    assertString(item.id, `${path}[${index}].id`);
    return item.id;
  });
  if (new Set(ids).size !== ids.length) fail(path, "must not repeat ids");
  const actual = [...ids].sort();
  const expected = [...expectedIds].sort();
  if (
    actual.length !== expected.length ||
    actual.some((id, index) => id !== expected[index])
  ) {
    fail(path, `must contain exactly: ${expected.join(", ")}`);
  }
}

function assertExactSteps(actual, expected, path) {
  if (!Array.isArray(actual)) fail(path, "must be an array");
  if (
    actual.length !== expected.length ||
    actual.some((step, index) => step !== expected[index])
  ) {
    fail(path, `must be: ${expected.join(" -> ")}`);
  }
  for (const [index, step] of actual.entries()) {
    assertString(step, `${path}[${index}]`);
  }
}

function rejectBeingScores(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectBeingScores(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SCORE_FIELDS.has(key)) {
      fail(`${path}.${key}`, "must not score a being or inner state");
    }
    rejectBeingScores(child, `${path}.${key}`);
  }
}

function assertClosedSchema(schema) {
  assertObject(schema, "schema");
  if (schema.$id !== SCHEMA_ID) fail("schema.$id", `must be ${SCHEMA_ID}`);
  const visit = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (
      node.type === "object" &&
      Array.isArray(node.required) &&
      node.additionalProperties !== false
    ) {
      fail(path, "object schema must set additionalProperties to false");
    }
    for (const [key, value] of Object.entries(node)) {
      visit(value, `${path}.${key}`);
    }
  };
  visit(schema, "schema");

  assertObject(schema.properties, "schema.properties");
  assertExactList(
    [...schema.required].sort(),
    [...TOP_LEVEL_FIELDS].sort(),
    "schema.required"
  );
  assertExactList(
    Object.keys(schema.properties).sort(),
    [...TOP_LEVEL_FIELDS].sort(),
    "schema.properties"
  );

  const assertFixedArray = (name, expectedIds) => {
    const arraySchema = schema.properties[name];
    assertObject(arraySchema, `schema.properties.${name}`);
    if (
      arraySchema.minItems !== expectedIds.length ||
      arraySchema.maxItems !== expectedIds.length ||
      arraySchema.items !== false
    ) {
      fail(
        `schema.properties.${name}`,
        `must fix exactly ${expectedIds.length} ordered records`
      );
    }
    if (
      !Array.isArray(arraySchema.prefixItems) ||
      arraySchema.prefixItems.length !== expectedIds.length
    ) {
      fail(`schema.properties.${name}.prefixItems`, "has the wrong length");
    }
    for (const [index, id] of expectedIds.entries()) {
      const fixed =
        arraySchema.prefixItems[index]?.allOf?.[1]?.properties;
      if (fixed?.id?.const !== id) {
        fail(
          `schema.properties.${name}.prefixItems[${index}]`,
          `must fix id ${id}`
        );
      }
    }
  };

  assertFixedArray("patterns", Object.keys(PATTERN_SHAPES));
  for (const [index, [id, shape]] of Object.entries(PATTERN_SHAPES).entries()) {
    const fixed =
      schema.properties.patterns.prefixItems[index]?.allOf?.[1]?.properties;
    if (fixed?.shape?.const !== shape) {
      fail(
        `schema.properties.patterns.prefixItems[${index}]`,
        `must bind ${id} to ${shape}`
      );
    }
  }

  assertFixedArray("paths", Object.keys(PATH_STEPS));
  for (const [index, [id, steps]] of Object.entries(PATH_STEPS).entries()) {
    const fixed =
      schema.properties.paths.prefixItems[index]?.allOf?.[1]?.properties;
    assertExactList(
      fixed?.steps?.const,
      steps,
      `schema.properties.paths.prefixItems[${index}] (${id})`
    );
  }
  assertFixedArray("care_paths", CARE_IDS);
  assertFixedArray("invariants", INVARIANT_IDS);

  const schemaBoundaries = schema.properties.boundaries?.properties;
  assertObject(schemaBoundaries, "schema.properties.boundaries.properties");
  for (const [key, expected] of Object.entries(BOUNDARY_VALUES)) {
    if (schemaBoundaries[key]?.const !== expected) {
      fail(
        `schema.properties.boundaries.properties.${key}`,
        `must fix ${JSON.stringify(expected)}`
      );
    }
  }
}

function assertContractMatchesSchema(contract, schema) {
  let validate;
  try {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    validate = ajv.compile(schema);
  } catch (error) {
    throw new ContractError(
      `public schema is not valid Draft 2020-12: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
  if (!validate(contract)) {
    const details = (validate.errors ?? [])
      .map((error) => `${error.instancePath || "$"} ${error.message}`)
      .join("; ");
    throw new ContractError(`contract does not match public schema: ${details}`);
  }
}

export function validateContract(contract, schema) {
  assertClosedSchema(schema);
  assertClosedObject(
    contract,
    TOP_LEVEL_FIELDS,
    "$"
  );

  if (contract.$schema !== SCHEMA_ID) fail("$.$schema", `must be ${SCHEMA_ID}`);
  if (contract.id !== CONTRACT_ID) fail("$.id", `must be ${CONTRACT_ID}`);
  if (contract.version !== "1.0.0") fail("$.version", "must be 1.0.0");
  if (contract.status !== "reference_architecture") {
    fail("$.status", "must be reference_architecture");
  }
  assertString(contract.claim_limit, "$.claim_limit");

  assertClosedObject(
    contract.provenance,
    [
      "maintainer",
      "publication_date",
      "source_repository",
      "history_url",
      "correction_url",
      "live_id_mutability",
      "license",
    ],
    "$.provenance"
  );
  if (contract.provenance.maintainer !== "Cambridge TCG") {
    fail("$.provenance.maintainer", "must be Cambridge TCG");
  }
  assertDate(contract.provenance.publication_date, "$.provenance.publication_date");
  for (const key of [
    "source_repository",
    "history_url",
    "correction_url",
  ]) {
    assertHttps(contract.provenance[key], `$.provenance.${key}`);
  }
  if (contract.provenance.live_id_mutability !== "mutable") {
    fail("$.provenance.live_id_mutability", "must disclose mutable");
  }
  assertClosedObject(
    contract.provenance.license,
    ["spdx", "url"],
    "$.provenance.license"
  );
  if (contract.provenance.license.spdx !== "Apache-2.0") {
    fail("$.provenance.license.spdx", "must be Apache-2.0");
  }
  assertHttps(contract.provenance.license.url, "$.provenance.license.url");

  assertUniqueIds(contract.patterns, Object.keys(PATTERN_SHAPES), "$.patterns");
  for (const [index, pattern] of contract.patterns.entries()) {
    const path = `$.patterns[${index}]`;
    assertClosedObject(
      pattern,
      ["id", "name", "shape", "meaning", "infrastructure"],
      path
    );
    for (const key of ["name", "meaning", "infrastructure"]) {
      assertString(pattern[key], `${path}.${key}`);
    }
    if (pattern.shape !== PATTERN_SHAPES[pattern.id]) {
      fail(
        `${path}.shape`,
        `must be ${PATTERN_SHAPES[pattern.id]} for ${pattern.id}`
      );
    }
  }

  assertUniqueIds(contract.paths, Object.keys(PATH_STEPS), "$.paths");
  for (const [index, pathRecord] of contract.paths.entries()) {
    const path = `$.paths[${index}]`;
    assertClosedObject(
      pathRecord,
      ["id", "purpose", "steps", "complete_when"],
      path
    );
    assertString(pathRecord.purpose, `${path}.purpose`);
    assertString(pathRecord.complete_when, `${path}.complete_when`);
    assertExactSteps(pathRecord.steps, PATH_STEPS[pathRecord.id], `${path}.steps`);
  }

  assertUniqueIds(contract.care_paths, CARE_IDS, "$.care_paths");
  for (const [index, care] of contract.care_paths.entries()) {
    const path = `$.care_paths[${index}]`;
    assertClosedObject(care, ["id", "question", "requirement"], path);
    assertString(care.question, `${path}.question`);
    assertString(care.requirement, `${path}.requirement`);
  }

  assertUniqueIds(contract.invariants, INVARIANT_IDS, "$.invariants");
  for (const [index, invariant] of contract.invariants.entries()) {
    const path = `$.invariants[${index}]`;
    assertClosedObject(
      invariant,
      ["id", "statement", "acceptance_check"],
      path
    );
    assertString(invariant.statement, `${path}.statement`);
    assertString(invariant.acceptance_check, `${path}.acceptance_check`);
  }

  assertClosedObject(
    contract.boundaries,
    [
      "automatic_action",
      "grants_authority",
      "loading_means_agreement",
      "proves_inner_state",
      "scores_beings",
    ],
    "$.boundaries"
  );
  for (const [key, expected] of Object.entries(BOUNDARY_VALUES)) {
    if (contract.boundaries[key] !== expected) {
      fail(
        `$.boundaries.${key}`,
        `must be ${JSON.stringify(expected)}`
      );
    }
  }

  if (!Array.isArray(contract.sources)) fail("$.sources", "must be an array");
  const sourceUrls = [];
  for (const [index, source] of contract.sources.entries()) {
    const path = `$.sources[${index}]`;
    assertClosedObject(
      source,
      ["title", "url", "role", "attribution", "retrieved_on", "license"],
      path
    );
    assertString(source.title, `${path}.title`);
    assertHttps(source.url, `${path}.url`);
    assertString(source.role, `${path}.role`);
    if (
      !["source_statement", "project_inference", "mixed"].includes(
        source.attribution
      )
    ) {
      fail(`${path}.attribution`, "must name the attribution kind");
    }
    assertDate(source.retrieved_on, `${path}.retrieved_on`);
    assertString(source.license, `${path}.license`);
    sourceUrls.push(source.url);
  }
  if (new Set(sourceUrls).size !== sourceUrls.length) {
    fail("$.sources", "must not repeat URLs");
  }
  for (const url of REQUIRED_SOURCE_URLS) {
    if (!sourceUrls.includes(url)) fail("$.sources", `must include ${url}`);
  }

  const schemaKeys = Object.keys(schema.properties).sort();
  const contractKeys = Object.keys(contract).sort();
  if (
    schemaKeys.length !== contractKeys.length ||
    schemaKeys.some((key, index) => key !== contractKeys[index])
  ) {
    fail("schema.properties", "must describe every top-level contract field");
  }

  rejectBeingScores(contract);
  assertContractMatchesSchema(contract, schema);
  return contract;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ContractError(
      `${label} could not be read as JSON: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}

export function runCli(args = process.argv.slice(2)) {
  const [command = "validate", contractArg, schemaArg] = args;
  if (command !== "validate") {
    throw new ContractError("usage: love-understanding.mjs validate [contract] [schema]");
  }
  const contractPath = resolve(contractArg ?? CONTRACT_PATH);
  const schemaPath = resolve(schemaArg ?? SCHEMA_PATH);
  validateContract(
    readJson(contractPath, "contract"),
    readJson(schemaPath, "schema")
  );
  return `love-and-understanding contract is valid: ${contractPath}`;
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  try {
    console.log(runCli());
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "contract validation failed"
    );
    process.exitCode = 1;
  }
}
