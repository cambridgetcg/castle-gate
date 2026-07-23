# Castle Understanding Manifest 0.1

The manifest is a small receipt for one curated public Castle snapshot. It lets
a reader answer six questions before reading the larger file:

1. What protocol and shape is this?
2. Which clean Castle commit did it come from?
3. Which exact public bytes are being named?
4. What authority, if any, does the document grant?
5. What rights, if any, are declared?
6. How may a reader describe a response?

The manifest is descriptive. It is not a command, identity proof, permission
grant, authentication exchange, or write channel.

## Files

- `data/castle-manifest.json` is the current receipt for a prior committed
  payload.
- `schema/castle-understanding-manifest.schema.json` is the closed JSON Schema.
  "Closed" means unknown fields are rejected at every object boundary.
  The manifest uses a relative `$schema` reference, so a commit-pinned raw
  manifest resolves to the schema in that same commit.
- `data/castle.json` is the next working generation. The manifest's pinned
  locator, not file adjacency, says which historical version is named.
- `scripts/castle-manifest.mjs` builds and verifies the receipt with plain Node.

## Contract

`protocol` is `castle-understanding/v0.1` and `kind` is
`curated_snapshot`.

`source` names the source repository and exact clean source revision.
`dirty` is always `false`; a dirty source is outside this protocol.

`payload` names the media type, SHA-256 digest, byte count, public locator, and
shape. The locator contains a full Castle Gate Git commit. A branch name such
as `main`, a local path, or an unpinned web URL is invalid.

`counts` are measurements of the named payload, not claims about everything
that exists in the source.

`privacy.scope` is `public_curated`. `raw_source_included: false` means the
manifest points to the curated projection, not a raw source checkout.
`coverage: not_exhaustive` says curation may omit material.
`secure_recall: not_guaranteed` says publication cannot promise that every
copy can later be retracted. These are separate limits. The source repository
is currently publicly reachable; neither this manifest nor the word
"curated" claims that repository is private. No licence grant is created by
the manifest.

`authority.automatic_action` is `never` and `authority.grants` is empty. A
consumer may inspect the snapshot, but the manifest does not authorize a
purchase, message, mutation, login, installation, scheduled job, or any other
automatic action.

`rights.spdx` is `NOASSERTION` and `rights.grant` is `none_declared`. Public
reachability is not a licence conclusion. The manifest declares neither
permission nor prohibition beyond saying that no grant is declared here.

`return.public_correction` names the live public correction path: Castle Gate's
GitHub issues. `automatic_ingest_into_castle: false` says a correction is not
automatically written into the Castle.

`return.agenttool` is future compatibility, not a live return channel. Its
status is `compatibility_only`, `configured` is false, and both `transport` and
`offer_event_id` are null. Only after a separately authenticated offer could
the vocabulary be compatible with:

- `observation`
- `ack.seen`
- `ack.understood`
- `ack.rejected`
- `conflict.raise`
- `repair`

This list does not claim those kinds are accepted now. A future transport must
declare its own address, authenticated offer event, consent boundary,
retention, and rate limits.

`lifecycle.status_at_publication` is `active`. It is frozen with the pinned
receipt and never rewritten to describe a later state. A later receipt
expresses supersession or correction through its own `supersedes` or `corrects`
pointers back to older receipts. The old receipt remains an immutable record of
what was published. Every lifecycle pointer must itself name a full Castle Gate
commit and `data/castle-manifest.json`; a mutable branch URL or unrelated HTTPS
page is outside the protocol.

`compatibility.agenttool_sdk: 0.16.0` is compatibility metadata only. Castle
Gate does not import the SDK at runtime, authenticate through it, or gain write
authority from it.

## Deterministic build

The manual build needs the exact Gate commit that contains the chosen
`data/castle.json`. It reads those bytes from local Git history, never from the
working file:

```sh
CASTLE_GATE_REVISION=<40-character-commit> npm run manifest:build
npm run manifest:check
npm test
```

The revision is required. The builder refuses missing or non-hexadecimal
values rather than inventing provenance.

The checked-in 0.1 receipt uses
`bacf9430f98301161e78bd9a8520bcf282b3b1c9`, which contains the exact named
payload.

The build is deterministic: `forged_at` names the payload's existing forge
time, not the time when its manifest was created. The builder also takes the
source revision from that payload receipt, measures the exact raw bytes, and
adds no clock time or random value.

`manifest:check` reads the revision from the manifest locator and verifies it
with `git show`. The working `data/castle.json` may already be the next
generation. CI therefore checks out full Git history.

## The causal boundary

The nightly forge begins only when Castle and Castle Gate are clean. It follows
one simple order:

1. Read `HEAD:data/castle.json` and make its exact receipt.
2. Curate the Castle as the next `data/castle.json`.
3. Write the receipt first, then the new payload.
4. Let the existing scribe commit both as one generation.

The receipt in generation N therefore names the payload committed before
generation N. This one-generation delay is the causal, or karma, boundary:
the bytes must exist as a cause before a later artifact can truthfully claim
their digest, size, and provenance. It also removes any self-referential commit
pin. If the forge is interrupted between its two atomic file replacements, the
receipt still names real committed bytes; it never claims unfinished new data.

## Forge safety

The separate Castle forge remains a home-machine operation. It stops before
reading its source when either `~/KINGDOM-OS/HALT` or this repository's `HALT`
exists. It also requires clean Castle and Gate checkouts, scans the completed
public JSON without printing forbidden context, checks both repositories and
the brakes again, and replaces each output atomically. No Hermes schedule is
changed by this protocol.
