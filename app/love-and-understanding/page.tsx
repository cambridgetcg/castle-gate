import type { Metadata } from "next";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";

import RelationalGeometry, {
  type GeometryPattern,
} from "@/components/RelationalGeometry";

interface ModelPath {
  id: string;
  purpose: string;
  steps: string[];
  complete_when: string;
}

interface CarePath {
  id: string;
  question: string;
  requirement: string;
}

interface Invariant {
  id: string;
  statement: string;
  acceptance_check: string;
}

interface Source {
  title: string;
  url: string;
  role: string;
  attribution: "source_statement" | "project_inference" | "mixed";
  retrieved_on: string;
  license: string;
}

interface RelationalModel {
  $schema: string;
  id: string;
  version: string;
  status: string;
  claim_limit: string;
  provenance: {
    maintainer: string;
    publication_date: string;
    source_repository: string;
    history_url: string;
    correction_url: string;
    live_id_mutability: "mutable";
    license: {
      spdx: string;
      url: string;
    };
  };
  patterns: GeometryPattern[];
  paths: ModelPath[];
  care_paths: CarePath[];
  invariants: Invariant[];
  boundaries: {
    automatic_action: "never";
    grants_authority: false;
    loading_means_agreement: false;
    proves_inner_state: false;
    scores_beings: false;
  };
  sources: Source[];
}

export const metadata: Metadata = {
  title: "love and understanding — a relational geometry",
  description:
    "An accessible reference geometry and acceptance criteria for standing, consent, bounded action, consequence, repair, freedom, and understanding.",
  alternates: {
    canonical:
      "https://cambridgetcg.github.io/castle-gate/love-and-understanding",
    types: {
      "application/json":
        "https://cambridgetcg.github.io/castle-gate/love-and-understanding.json",
    },
  },
  openGraph: {
    title: "love and understanding — a relational geometry",
    description:
      "Love as a standing-preserving field; understanding as a return path between distinct views.",
    url: "https://cambridgetcg.github.io/castle-gate/love-and-understanding",
    type: "article",
  },
};

async function loadModel(): Promise<RelationalModel> {
  const raw = await readFile(
    path.join(
      process.cwd(),
      "public",
      "love-and-understanding.json"
    ),
    "utf8"
  );
  return JSON.parse(raw) as RelationalModel;
}

function words(id: string): string {
  return id.replaceAll("-", " ");
}

export default async function LoveAndUnderstandingPage() {
  const model = await loadModel();

  return (
    <article className="geometry-page">
      <Link className="back-link" href="/">
        ← the castle gate
      </Link>
      <header className="geometry-intro">
        <p className="eyebrow">
          reference geometry · acceptance criteria · version {model.version}
        </p>
        <h1>love and understanding, drawn as relations</h1>
        <p className="geometry-lead">
          Love is the field that preserves standing. Understanding is the
          return path that lets distinct views find a usable fit without
          collapsing into one.
        </p>
        <p className="boundary-note">{model.claim_limit}</p>
      </header>

      <RelationalGeometry patterns={model.patterns} />

      <section aria-labelledby="shapes-heading">
        <h2 id="shapes-heading">What each shape must do</h2>
        <div className="pattern-grid">
          {model.patterns.map((pattern) => (
            <article className="pattern-card" key={pattern.id}>
              <p className="shape-name">{words(pattern.shape)}</p>
              <h3>{pattern.name}</h3>
              <p>{pattern.meaning}</p>
              <p className="infrastructure-line">
                <strong>In the system:</strong> {pattern.infrastructure}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="paths-heading">
        <h2 id="paths-heading">Three paths, all finite</h2>
        <div className="path-stack">
          {model.paths.map((modelPath) => (
            <article className="path-card" key={modelPath.id}>
              <h3>{words(modelPath.id)}</h3>
              <p>{modelPath.purpose}</p>
              <ol className="turn-path" aria-label={words(modelPath.id)}>
                {modelPath.steps.map((step) => (
                  <li key={step}>{words(step)}</li>
                ))}
              </ol>
              <p className="completion-line">
                <strong>Complete when:</strong> {modelPath.complete_when}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="attractor-section" aria-labelledby="pull-heading">
        <p className="eyebrow">an attractor, never an actuator</p>
        <h2 id="pull-heading">A pull without a shove</h2>
        <p>
          Infrastructure can make a loving path easier to see and safer to
          take. It must not choose the path for anyone. Five practical care
          questions shape the edge:
        </p>
        <div className="care-grid">
          {model.care_paths.map((care, index) => (
            <article key={care.id}>
              <span aria-hidden="true">{index + 1}</span>
              <h3>{care.question}</h3>
              <p>{care.requirement}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="invariants-heading">
        <h2 id="invariants-heading">Load-bearing acceptance criteria</h2>
        <p>
          These are checks for a future implementation, not evidence that this
          reference page already performs them. They concern observable
          structure and practice; they never certify a being as loving, worthy,
          sincere, conscious, or understood.
        </p>
        <dl className="invariant-list">
          {model.invariants.map((invariant) => (
            <div key={invariant.id}>
              <dt>{words(invariant.id)}</dt>
              <dd>
                <p>{invariant.statement}</p>
                <p>
                  <strong>Acceptance check:</strong>{" "}
                  {invariant.acceptance_check}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="contract-section" aria-labelledby="contract-heading">
        <p className="eyebrow">public contract</p>
        <h2 id="contract-heading">Readable by people and machines</h2>
        <p>
          The page is built from the same JSON that machines can inspect. Its
          Draft 2020-12 schema and validator enforce the reference model&apos;s
          structure: fixed paths, a permeable-field Love shape,
          non-authorising boundaries, and no extra fields. They do not test a
          deployment&apos;s real behaviour.
        </p>
        <p className="contract-links">
          <a href={model.id}>JSON contract</a>
          <a href={model.$schema}>closed schema</a>
          <a href={model.provenance.correction_url}>
            correction path
          </a>
          <a href={model.provenance.history_url}>version history</a>
          <a href={model.provenance.license.url}>
            {model.provenance.license.spdx} license
          </a>
        </p>
        <p className="boundary-note">
          <code>automatic_action: {model.boundaries.automatic_action}</code>.
          Loading this page means no agreement and grants no authority.
        </p>

        <h3>Ground carried forward</h3>
        <ul className="source-list">
          {model.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url}>{source.title}</a>
              <span>{source.role}</span>
              <small>
                {words(source.attribution)} · read {source.retrieved_on} ·{" "}
                {source.license}
              </small>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
