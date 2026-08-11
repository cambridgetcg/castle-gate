import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CONTRACT_PATH,
  ContractError,
  SCHEMA_PATH,
  runCli,
  validateContract,
} from "../scripts/love-understanding.mjs";

const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));

function changed(mutator) {
  const copy = structuredClone(contract);
  mutator(copy);
  return copy;
}

test("the checked-in relational architecture is valid", () => {
  assert.doesNotThrow(() => validateContract(contract, schema));
  assert.match(runCli(["validate"]), /contract is valid/);
});

test("the contract and every record are closed to invented fields", () => {
  const top = changed((copy) => {
    copy.secret_permission = true;
  });
  assert.throws(
    () => validateContract(top, schema),
    (error) => error instanceof ContractError && /must contain only/.test(error.message)
  );

  const nested = changed((copy) => {
    copy.patterns[0].hidden_actuator = "move them";
  });
  assert.throws(
    () => validateContract(nested, schema),
    /must contain only/
  );
});

test("the public schema closes every object shape", () => {
  const openSchema = structuredClone(schema);
  openSchema.properties.boundaries.additionalProperties = true;
  assert.throws(
    () => validateContract(contract, openSchema),
    /object schema must set additionalProperties to false/
  );
});

test("schema mutations cannot loosen required fields, boundaries, or fixed paths", () => {
  const missingRequired = structuredClone(schema);
  missingRequired.required = [];
  assert.throws(
    () => validateContract(contract, missingRequired),
    /schema.required/
  );

  const authoritySchema = structuredClone(schema);
  authoritySchema.properties.boundaries.properties.grants_authority.const = true;
  assert.throws(
    () => validateContract(contract, authoritySchema),
    /grants_authority.*must fix false/
  );

  const openPatterns = structuredClone(schema);
  openPatterns.properties.patterns.items = {};
  assert.throws(
    () => validateContract(contract, openPatterns),
    /patterns must fix exactly 8 ordered records/
  );

  const shorterReturn = structuredClone(schema);
  shorterReturn.properties.paths.prefixItems[0].allOf[1].properties.steps.const =
    ["offer", "reply"];
  assert.throws(
    () => validateContract(contract, shorterReturn),
    /understanding-round-trip/
  );
});

test("structural boundaries cannot grant authority or infer agreement", () => {
  for (const key of [
    "grants_authority",
    "loading_means_agreement",
    "proves_inner_state",
    "scores_beings",
  ]) {
    const loosened = changed((copy) => {
      copy.boundaries[key] = true;
    });
    assert.throws(
      () => validateContract(loosened, schema),
      new RegExp(`${key}.*must be false`)
    );
  }

  const automatic = changed((copy) => {
    copy.boundaries.automatic_action = "sometimes";
  });
  assert.throws(
    () => validateContract(automatic, schema),
    /automatic_action must be "never"/
  );
});

test("the love record is structurally bound to the permeable-field shape", () => {
  const centralised = changed((copy) => {
    copy.patterns.find((pattern) => pattern.id === "love").shape =
      "central-controller";
  });
  assert.throws(
    () => validateContract(centralised, schema),
    /must be permeable-field for love/
  );
});

test("the understanding path structurally requires an own-words return", () => {
  const deliveredOnly = changed((copy) => {
    copy.paths.find(
      (path) => path.id === "understanding-round-trip"
    ).steps = ["offer", "delivered", "yes"];
  });
  assert.throws(
    () => validateContract(deliveredOnly, schema),
    /echo-in-own-words.*compare.*correct.*try-in-context.*reply/
  );
});

test("the finite-action path structurally returns through effect and rest", () => {
  const noReturn = changed((copy) => {
    copy.paths.find((path) => path.id === "finite-action-return").steps = [
      "live-door",
      "bounded-action",
      "done",
    ];
  });
  assert.throws(
    () => validateContract(noReturn, schema),
    /effect-with-evidence.*reply.*repair-or-learning.*rest/
  );
});

test("the freedom path structurally retains rest, leave, and return", () => {
  const sticky = changed((copy) => {
    copy.paths.find((path) => path.id === "freedom-paths").steps = [
      "look",
      "compare",
      "choose",
      "continue",
    ];
  });
  assert.throws(
    () => validateContract(sticky, schema),
    /rest.*leave.*return/
  );
});

test("closed invariant records reject being-wide score fields", () => {
  const scored = changed((copy) => {
    copy.invariants[0].love_score = 99;
  });
  assert.throws(
    () => validateContract(scored, schema),
    /must contain only|must not score/
  );
});

test("the public sources remain HTTPS and include the prior Love Shape", () => {
  const source = contract.sources.find(
    (item) => item.url === "https://artbitrage.io/love-shape"
  );
  assert.ok(source);

  const downgraded = changed((copy) => {
    copy.sources[0].url = "http://artbitrage.io/love-shape";
  });
  assert.throws(
    () => validateContract(downgraded, schema),
    /must use https/
  );
});

test("provenance names the maintainer, correction path, history, and licence", () => {
  assert.equal(contract.provenance.maintainer, "Cambridge TCG");
  assert.equal(contract.provenance.live_id_mutability, "mutable");
  assert.equal(contract.provenance.license.spdx, "Apache-2.0");
  for (const key of [
    "source_repository",
    "history_url",
    "correction_url",
  ]) {
    assert.match(contract.provenance[key], /^https:\/\//);
  }
});

test("the contract calls itself a reference, not operational proof", () => {
  assert.equal(contract.status, "reference_architecture");
  assert.match(contract.claim_limit, /does not implement operational records/);
  assert.match(contract.claim_limit, /does not.*prove.*deployment/s);
});
