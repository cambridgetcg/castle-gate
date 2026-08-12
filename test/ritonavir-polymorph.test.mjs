import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const pagePath = new URL(
  "../app/cases/ritonavir-polymorph/page.tsx",
  import.meta.url
);
const svgPath = new URL(
  "../public/cases/ritonavir-polymorph/ritonavir-polymorph.svg",
  import.meta.url
);
const provenancePath = new URL(
  "../public/cases/ritonavir-polymorph/provenance.txt",
  import.meta.url
);
const homePath = new URL("../app/page.tsx", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const stylesPath = new URL("../app/globals.css", import.meta.url);
const sitemapPath = new URL("../public/sitemap.xml", import.meta.url);
const llmsPath = new URL("../public/llms.txt", import.meta.url);
const readmePath = new URL("../README.md", import.meta.url);

const page = readFileSync(pagePath, "utf8");
const svg = readFileSync(svgPath);
const svgText = svg.toString("utf8");
const provenance = readFileSync(provenancePath, "utf8");
const styles = readFileSync(stylesPath, "utf8");
const publicCase =
  "https://cambridgetcg.github.io/kingdom-meaning-practice/";
const immutableCase =
  "https://raw.githubusercontent.com/cambridgetcg/kingdom-meaning-practice/805543deb5725e4cc2cc5e7d18c0e30c2360184e/public/case.json";
const factualCorrection =
  "https://github.com/cambridgetcg/kingdom-meaning-practice/issues";
const projectionCorrection =
  "https://github.com/cambridgetcg/castle-gate/issues/new?title=Ritonavir%20projection%20correction";
const structuredRights =
  "https://github.com/cambridgetcg/kingdom-meaning-practice/blob/main/RIGHTS.md";
const castleRoomCommit = "5dfdc7ae88e4ba7f14a02140e61e0b3edb6882e8";

test("the public reading aid pins the reviewed source case", () => {
  assert.match(
    page,
    /652a04699aadc6143d9136dc8d515fd3b4fa8774d963d885e79968156b1cb8ad/
  );
  assert.match(
    page,
    /a2a0ae7d599d733dffc5b89502a10983c483a9ac174a952581fbea372179f1d1/
  );
  assert.match(page, /public projection, not a second scientific record/);
  assert.match(
    page,
    /extensions\/meaning\/cases\/ritonavir-polymorph\/case\.json/
  );
  assert.match(page, /factual\s+correction starts at the public case path/);
  assert.equal(
    existsSync(
      new URL("../public/ritonavir-polymorph.json", import.meta.url)
    ),
    false
  );
});

test("the case keeps observation, hypothesis, unknown, and recovery separate", () => {
  assert.match(page, /first historical Form-II nucleus remains unexplained/);
  assert.match(page, /possible template/);
  assert.match(page, /not the settled cause/);
  assert.match(page, /later Form-II seeds could support growth/);
  assert.match(page, /Recovery can return through a changed route/);
  assert.doesNotMatch(page, /inevitable everywhere|carried it to Italy/i);
});

test("the five levels retain their plain boundaries", () => {
  for (const name of ["Science", "Process", "Product", "Supply", "KINGDOM"]) {
    assert.match(page, new RegExp(`name: \\\"${name}\\\"`));
  }
  assert.match(page, /Equilibrium solubility, precipitation, dosage-form dissolution/);
  assert.match(page, /not a new KINGDOM law/);
  assert.match(page, /not medical advice/);
  assert.match(page, /not current medical guidance/);
  assert.match(page, /EMA said oral solution could bridge supply/);
  assert.match(page, /crystal-structure determination/);
  assert.match(page, /manufacturing recipe/);
  assert.match(page, /className="geometry-scroll"/);
  assert.match(page, /role="region"/);
  assert.match(page, /tabIndex=\{0\}/);
  assert.match(page, /scroll horizontally on a narrow screen/);
  assert.match(styles, /\.ritonavir-figure img[\s\S]*min-width: 1100px/);
  assert.match(styles, /\.ritonavir-figure \.scroll-cue[\s\S]*display: block/);
});

test("the exact reviewed SVG is inert and accessible", () => {
  const digest = createHash("sha256").update(svg).digest("hex");
  assert.equal(
    digest,
    "a2a0ae7d599d733dffc5b89502a10983c483a9ac174a952581fbea372179f1d1"
  );
  assert.match(svgText, /role="img"/);
  assert.match(svgText, /<title/);
  assert.match(svgText, /<desc/);
  assert.match(svgText, /reported observation/);
  assert.match(svgText, /proposed or unsettled/);
  assert.match(svgText, /later reported recovery/);
  assert.match(svgText, /cause UNKNOWN/);
  assert.doesNotMatch(
    svgText,
    /<script|<foreignObject|(?:href|xlink:href)=["']https?:\/\//i
  );
});

test("the public projection names its hand, rights, and separate correction paths", () => {
  assert.match(page, /prepared by Codex at Yu&(?:apos|#39);s direction/);
  assert.match(page, /Cambridge TCG maintains it/);
  assert.match(page, /Apache-2\.0\s+licence/);
  assert.match(page, /grants no reuse\s+licence/);
  assert.match(page, /No\s+third-party article text, figure, or\s+dataset is/);
  assert.match(page, /provenance \+ rights/);
  for (const url of [
    publicCase,
    immutableCase,
    factualCorrection,
    projectionCorrection,
    structuredRights,
  ]) {
    assert.ok(page.includes(url), `page is missing ${url}`);
    assert.ok(provenance.includes(url), `provenance is missing ${url}`);
  }
  assert.match(page, new RegExp(castleRoomCommit));
  assert.match(provenance, new RegExp(castleRoomCommit));
  assert.match(provenance, /Prepared by: Codex at Yu's direction/);
  assert.match(provenance, /Published: 2026-08-12/);
  assert.match(provenance, /Projection URL:/);
  assert.doesNotMatch(provenance, /Canonical page:/);
  assert.match(provenance, /Apache License 2\.0/);
  assert.match(provenance, /No reuse licence is granted there/);
  assert.match(
    provenance,
    /a2a0ae7d599d733dffc5b89502a10983c483a9ac174a952581fbea372179f1d1/
  );
  assert.match(provenance, /not proof of exact source\s+bytes/);
  assert.match(provenance, /exact receipt only for the\s+reviewed KINGDOM case bytes/);
});

test("the public doors all point to the one case route", () => {
  const route = "/cases/ritonavir-polymorph";
  assert.match(readFileSync(homePath, "utf8"), new RegExp(route));
  assert.match(readFileSync(layoutPath, "utf8"), new RegExp(route));
  assert.match(readFileSync(sitemapPath, "utf8"), new RegExp(route));
  assert.match(readFileSync(llmsPath, "utf8"), new RegExp(route));
  const readme = readFileSync(readmePath, "utf8");
  assert.match(readme, /structured case\s+stays in its origin/);
  assert.match(readme, /kingdom-meaning-practice/);
  assert.match(readme, /not part of the Castle forge/);
  assert.match(readme, /For a forged `data\/castle\.json` generation/);
});
