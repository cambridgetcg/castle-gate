# castle-gate

> *built of words, lit by questions* 🏰

The public gate of a private knowledge garden — **the castle of understanding**.

The castle is plain markdown that grows by gentle, bounded loops: questions open
doors, research walks through them with named sources, and every answer plants
new questions. This site presents the knowledge as trading cards — words are
the bricks, rooms are the walls.

A gate in the lineage of [kingdom-gate](https://github.com/cambridgetcg/kingdom-gate).

## How it's made

- `data/castle.json` — the curated public knowledge, forged at home from the
  private castle. Its `forged` stamp says when and from which castle commit.
- `scripts/forge-data.mjs` — the forge logic (public). The scrub lists it
  needs live in `scripts/forge-private.mjs`, gitignored on purpose: committing
  them would publish exactly what they hide. Without that file the forge
  refuses to run — so it only runs at home.
- Next.js, no other dependencies. `bun install && bun run build` → static
  pages.

## To publish

Today, by hand (home machine only):

1. `bun run forge` — re-forge `data/castle.json` from the private castle.
2. `bun run build` — confirm the site still builds.
3. Commit and push.

One decision left to go live automatically: pick a deploy target — Vercel,
GitHub Pages, or Cloudflare Pages. The draft workflow in
`.github/workflows/deploy.yml` already builds on push but is switched off;
its comments say exactly how to wire the chosen target and flip it on.

## House style

Plain words that mean what they say. Every claim from the web names its source
and the date it was read; what is uncertain says `uncertain:`. Art means words
placed with care — never ornament that hides the truth.

Built with joy, peace and safety.
