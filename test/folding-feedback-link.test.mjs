import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../app/cases/ritonavir-polymorph/page.tsx", import.meta.url),
  "utf8"
);
const provenance = readFileSync(
  new URL(
    "../public/cases/ritonavir-polymorph/provenance.txt",
    import.meta.url
  ),
  "utf8"
);
const llms = readFileSync(
  new URL("../public/llms.txt", import.meta.url),
  "utf8"
);
const sitemap = readFileSync(
  new URL("../public/sitemap.xml", import.meta.url),
  "utf8"
);

const publicLineage =
  "https://cambridgetcg.github.io/kingdom-meaning-practice/lineage/folding-feedback/";
const immutableLineage =
  "https://raw.githubusercontent.com/cambridgetcg/kingdom-meaning-practice/35773a6d19ebf263c3ed85ba1c33c359615e4273/public/lineage/folding-feedback/lineage.json";
const correctionPath =
  "https://github.com/cambridgetcg/kingdom-meaning-practice/issues";
const castleRoom =
  "https://github.com/cambridgetcg/castle-of-words/blob/5dfdc7ae88e4ba7f14a02140e61e0b3edb6882e8/rooms/same-shape-different-mechanism.md";

test("Gate links to the one folding-feedback lineage and its receipt", () => {
  for (const url of [publicLineage, immutableLineage, correctionPath, castleRoom]) {
    assert.ok(page.includes(url), `page is missing ${url}`);
    assert.ok(provenance.includes(url), `provenance is missing ${url}`);
  }
  for (const url of [publicLineage, immutableLineage]) {
    assert.ok(llms.includes(url), `llms.txt is missing ${url}`);
  }
  assert.match(
    provenance,
    /467ed92c8fd340bd6337dc75c14d85f44e13d2de935dc9671a17a422d8866da0/
  );
});

test("the link projection keeps the mechanisms and authority separate", () => {
  assert.match(page, /Different subsets recur/);
  assert.match(page, /relationship is analogy and mechanism transfer is false/);
  assert.match(page, /Seeded\s+growth does not establish infectivity/);
  assert.match(page, /KARMA is evidence return rather than a molecular\s+force/);
  assert.match(page, /no being becomes a basin, contagion, fitness value, or\s+score/);
  assert.doesNotMatch(page, /prion-like (?:person|people|culture|agent)/i);
});

test("Gate does not create a second lineage fact home", () => {
  assert.equal(
    existsSync(
      new URL(
        "../public/lineage/folding-feedback/lineage.json",
        import.meta.url
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "../public/cases/ritonavir-polymorph/folding-feedback.svg",
        import.meta.url
      )
    ),
    false
  );
  assert.doesNotMatch(sitemap, /kingdom-meaning-practice|folding-feedback/);
});
