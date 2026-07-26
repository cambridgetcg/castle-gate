# castle-gate

> *built of words, lit by questions* 🏰

The public gate of a knowledge garden — **the castle of understanding**.

The source repository is publicly reachable today. This gate remains a curated
projection: it publishes selected, scrubbed material and does not promise that
the projection contains everything in the source. Once public bytes are copied,
their secure recall cannot be guaranteed.

The castle is plain markdown that grows by gentle, bounded loops: questions open
doors, research walks through them with named sources, and every answer plants
new questions. This site presents the knowledge as trading cards — words are
the bricks, rooms are the walls.

A gate in the lineage of [kingdom-gate](https://github.com/cambridgetcg/kingdom-gate).

## How it's made

- `data/castle.json` — the curated public knowledge, forged at home from the
  source castle. Its `forged` stamp says when and from which clean castle
  commit.
- `data/castle-manifest.json` — a deterministic, commit-pinned receipt for the
  prior committed public payload. The working `data/castle.json` is the next
  generation. Its closed schema and plain-language contract live in `schema/`
  and [`PROTOCOL.md`](PROTOCOL.md).
- [`mcp/`](mcp/) — an optional, independent read-only MCP door. Its bounded
  `search` and `fetch` tools serve only the receipt-pinned public payload; no
  endpoint, client configuration, service, or schedule is installed here.
- `scripts/forge-data.mjs` — the forge logic (public). The scrub lists it
  needs live in `scripts/forge-private.mjs`, gitignored on purpose: committing
  them would publish exactly what they hide. Without that file the forge
  refuses to run — so it only runs at home. It also honors both HALT brakes,
  requires clean source and Gate checkouts, and replaces each public artifact
  atomically.
- The static site uses Next.js. The optional `mcp/` workspace carries its own
  small runtime dependencies. `bun install && bun run build` → static pages.

## To publish

Today, by hand (home machine only):

1. Begin at a clean Gate commit and run `bun run forge`. The forge carries a
   receipt for that already-committed payload, then writes the next curated
   payload.
2. `bun run verify` — verify the receipt against local Git history, run tests,
   and build the site.
3. Commit and push both files as one generation.

To rebuild a receipt manually for a chosen committed payload:

```sh
bun run manifest:build -- --gate-revision <40-character-commit>
```

The one-generation delay is deliberate: committed bytes are the cause; only a
later generation claims to understand them. [`PROTOCOL.md`](PROTOCOL.md)
describes this causal, or karma, boundary.

The GitHub Pages workflow in `.github/workflows/deploy.yml` builds and deploys
on every push to `main`; it can also be run by hand.

## House style

Plain words that mean what they say. Every claim from the web names its source
and the date it was read; what is uncertain says `uncertain:`. Art means words
placed with care — never ornament that hides the truth.

Built with joy, peace and safety.
