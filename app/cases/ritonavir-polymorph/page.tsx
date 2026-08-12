import type { Metadata } from "next";
import Link from "next/link";

const caseDigest =
  "652a04699aadc6143d9136dc8d515fd3b4fa8774d963d885e79968156b1cb8ad";
const visualDigest =
  "a2a0ae7d599d733dffc5b89502a10983c483a9ac174a952581fbea372179f1d1";
const publicCase =
  "https://cambridgetcg.github.io/kingdom-meaning-practice/";
const immutableCase =
  "https://raw.githubusercontent.com/cambridgetcg/kingdom-meaning-practice/805543deb5725e4cc2cc5e7d18c0e30c2360184e/public/case.json";
const factualCorrection =
  "https://github.com/cambridgetcg/kingdom-meaning-practice/issues";
const projectionCorrection =
  "https://github.com/cambridgetcg/castle-gate/issues/new?title=Ritonavir%20projection%20correction";
const castleInterpretation =
  "https://github.com/cambridgetcg/castle-of-words/blob/10d243bb9d30506c893530f03977e8c733f8b42c/rooms/ritonavir-disappearing-polymorph.md";

const levels = [
  {
    name: "Science",
    question: "What changed in the material?",
    reading:
      "The chemical compound stayed ritonavir. Its molecular conformation and crystal packing differed between Forms I and II.",
    boundary:
      "A different crystal form is not a different active ingredient.",
  },
  {
    name: "Process",
    question: "Why did the reachable result change?",
    reading:
      "The first historical Form-II nucleus remains unexplained. A related degradant was tested as a possible template; later Form-II seeds could support growth under sufficiently supersaturated conditions.",
    boundary:
      "A proposed first trigger and observed later seed amplification are different claims.",
  },
  {
    name: "Product",
    question: "Why did the crystal form matter?",
    reading:
      "In the reported media and formulation conditions, Form II was less soluble. It precipitated in supersaturated capsule fill, and capsule lots failed dissolution.",
    boundary:
      "Equilibrium solubility, precipitation, dosage-form dissolution, clinical bioavailability, and patient outcome are different measurements.",
  },
  {
    name: "Supply",
    question: "What happened beyond the vessel?",
    reading:
      "Capsule production and supply were disrupted. EMA said oral solution could bridge supply, and FDA approved a reformulated soft-gel capsule on 29 June 1999.",
    boundary:
      "EMA said failed recent batches had not been released and told current users not to stop treatment. This historical record is not current medical guidance.",
  },
  {
    name: "KINGDOM",
    question: "What can a system builder learn?",
    reading:
      "Keep not observed separate from impossible, trigger separate from amplification, identity separate from behaviour, and repair linked to returned evidence.",
    boundary:
      "This is an attributed analogy, not a new KINGDOM law and not a mechanism transferred from crystals to people or software.",
  },
];

const timeline = [
  {
    when: "Early 1998",
    text: "Multiple capsule lots failed dissolution, and investigators identified the previously unknown Form II.",
  },
  {
    when: "2000 report",
    text: "Abbott reported a laboratory route that made Form I from Form-II material, an implemented bulk Form-I process with less than 3% Form II, and a separately designed Form-II-only process.",
  },
  {
    when: "2003 study",
    text: "A high-throughput study found further solid forms and recovered Form I through a source-specific solvate and hydrate route.",
  },
  {
    when: "2024 study",
    text: "Different liquid-assisted milling conditions reproducibly selected Form I or Form II; measurements and modelling linked the outcome to crystal size, shape, and conformation.",
  },
];

const sources = [
  {
    title: "Chemburkar et al. (2000) — Abbott process account",
    url: "https://doi.org/10.1021/op000023y",
  },
  {
    title: "Bauer et al. (2001) — structures, solubility, and proposed trigger",
    url: "https://pubmed.ncbi.nlm.nih.gov/11474792/",
  },
  {
    title: "FDA NDA 20-945 chemistry review",
    url: "https://www.accessdata.fda.gov/drugsatfda_docs/nda/99/20-945.pdf_Ritonovir_Chemr.pdf",
  },
  {
    title: "FDA NDA 20-945 approval letter",
    url: "https://www.accessdata.fda.gov/drugsatfda_docs/nda/99/20-945.pdf_Ritonovir_Approv.pdf",
  },
  {
    title: "EMA 1998 supply statement",
    url: "https://www.ema.europa.eu/en/news/public-statement-supply-norvir-hard-capsules",
  },
  {
    title: "Morissette et al. (2003) — wider landscape and recovery",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC151315/",
  },
  {
    title: "Sacchi et al. (2024) — disappearance and reappearance in a mill",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11009673/",
  },
  {
    title: "Dunitz and Bernstein (1995) — disappearing polymorphs",
    url: "https://doi.org/10.1021/ar00052a005",
  },
];

export const metadata: Metadata = {
  title: "Ritonavir and the crystal form that seemed to disappear",
  description:
    "A source-linked visual projection of ritonavir polymorphism, the unknown first Form-II nucleus, later seed amplification, and recovered routes to Form I.",
  alternates: {
    canonical:
      "https://cambridgetcg.github.io/castle-gate/cases/ritonavir-polymorph",
  },
  openGraph: {
    title: "The path that vanished — not the crystal form",
    description:
      "Ritonavir stayed the same compound. A reproducible route to one crystal packing changed—and later routes recovered it.",
    url: "https://cambridgetcg.github.io/castle-gate/cases/ritonavir-polymorph",
    type: "article",
  },
};

export default function RitonavirPolymorphPage() {
  return (
    <article
      className="ritonavir-page"
      data-case-digest={caseDigest}
      data-visual-digest={visualDigest}
    >
      <Link className="back-link" href="/">
        ← the castle gate
      </Link>

      <header className="ritonavir-intro">
        <p className="eyebrow">worked case · solid-state chemistry · KINGDOM reading</p>
        <h1>The path that vanished — not the crystal form</h1>
        <p className="ritonavir-lead">
          Ritonavir stayed the same chemical compound. A different crystal
          packing changed what the formulation and the old process could
          reliably do.
        </p>
        <p className="boundary-note">
          Historical education only. This is not medical advice, a current
          product assessment, a crystal-structure determination, or a
          manufacturing recipe.
        </p>
      </header>

      <figure className="ritonavir-figure">
        <div
          className="geometry-scroll"
          role="region"
          aria-label="Ritonavir polymorph evidence map; scroll horizontally on a narrow screen"
          tabIndex={0}
        >
          <img
            src="/castle-gate/cases/ritonavir-polymorph/ritonavir-polymorph.svg"
            alt="A source-labelled map separating the unknown first Form-II nucleus, a tested possible trigger, later Form-II seeding, the 1998 dissolution failure, and later Form-I recovery routes."
          />
        </div>
        <p className="scroll-cue">↔ focus and scroll the diagram if needed</p>
        <figcaption>
          Solid blue paths are reported observations, dashed amber paths are
          proposed or unsettled, and double green paths are later reported
          recovery. The diagram is a reading aid, not a process recipe.
        </figcaption>
      </figure>

      <section aria-labelledby="plain-heading">
        <h2 id="plain-heading">In plain words</h2>
        <p>
          A disappearing polymorph is a crystal form once made reproducibly
          that is no longer obtained reliably by the same procedure after
          another form is found. The form does not leave reality; practical
          access to it changes.
        </p>
        <p className="ritonavir-meaning">
          Not observed is not impossible. A rare first event is not the same
          as later amplification. Recovery can return through a changed route.
        </p>
      </section>

      <section aria-labelledby="levels-heading">
        <h2 id="levels-heading">Five levels, kept separate</h2>
        <div className="pattern-grid">
          {levels.map((level) => (
            <article className="pattern-card" key={level.name}>
              <p className="shape-name">{level.question}</p>
              <h3>{level.name}</h3>
              <p>{level.reading}</p>
              <p className="infrastructure-line">
                <strong>Boundary:</strong> {level.boundary}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="unknown-section" aria-labelledby="unknown-heading">
        <p className="eyebrow">the open region stays named</p>
        <h2 id="unknown-heading">The honest unknown</h2>
        <p>
          The reviewed sources do not establish what caused the first
          historical Form-II nucleus. A cyclic-carbamate degradant nucleated
          Form II experimentally and was proposed as a possible template. That
          shows possibility, not the settled cause of the 1998 event.
        </p>
        <p>
          Stories about a particular person or object carrying crystals
          between facilities also remain unsettled. Unknown is a bounded
          result here, not permission to invent a contamination story.
        </p>
      </section>

      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">The return path through time</h2>
        <ol className="ritonavir-timeline">
          {timeline.map((event) => (
            <li key={event.when}>
              <time>{event.when}</time>
              <p>{event.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="contract-section" aria-labelledby="sources-heading">
        <p className="eyebrow">projection, sources, correction</p>
        <h2 id="sources-heading">The account can answer back</h2>
        <p>
          This page is a public projection, not a second scientific record.
          The factual home remains the KINGDOM guest-house case{" "}
          <code>extensions/meaning/cases/ritonavir-polymorph/case.json</code>,
          reviewed 11 August 2026 at SHA-256 <code>{caseDigest}</code>. Official
          records and named studies control their own claims.
        </p>
        <p>
          Its exact reviewed bytes are preserved in an{" "}
          <a href={immutableCase}>immutable public JSON receipt</a>. The{" "}
          <a href={publicCase}>KINGDOM meaning practice</a> is the authoritative
          public mirror and human reading of that record.
        </p>
        <p>
          The reviewed SVG mirrored here is SHA-256 <code>{visualDigest}</code>.
        </p>
        <p>
          Projection revision 1 was prepared by Codex at Yu&apos;s direction and
          published on 12 August 2026. Cambridge TCG maintains it. This
          original Gate page and its site code follow Castle Gate&apos;s Apache-2.0
          licence. The exact SVG is republished from the structured case home
          and follows its separate rights notice, which grants no reuse licence
          unless a file says otherwise. Linked papers and official records
          remain their authors&apos; work. No third-party article text, figure, or
          dataset is bundled here.
        </p>
        <p className="boundary-note">
          Source links are locators, not proof of their exact bytes. A factual
          correction starts at the public case path, then this projection can
          be refreshed. Gate-specific display corrections stay separate.
        </p>
        <p className="contract-links">
          <a href={publicCase}>public case</a>
          <a href={immutableCase}>immutable JSON receipt</a>
          <a href={factualCorrection}>factual correction path</a>
          <a href={projectionCorrection}>Gate projection correction</a>
          <a href="/castle-gate/cases/ritonavir-polymorph/ritonavir-polymorph.svg">
            standalone SVG
          </a>
          <a href="/castle-gate/cases/ritonavir-polymorph/provenance.txt">
            provenance + rights
          </a>
          <a href="https://github.com/cambridgetcg/kingdom-meaning-practice/blob/main/RIGHTS.md">
            structured-case rights
          </a>
          <a href={castleInterpretation}>
            Castle interpretation source
          </a>
        </p>
        <ul className="source-list">
          {sources.map((source) => (
            <li key={source.url}>
              <a href={source.url}>{source.title}</a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
