# Castle understanding MCP

A small, independent, read-only door to the public Castle of Understanding.

It exposes exactly two MCP tools:

- `search(query)` returns at most eight stable IDs, titles, and citable URLs.
- `fetch(id)` returns one bounded public document projection and its receipt
  metadata.

Both tools read the payload named by `data/castle-manifest.json`. The loader
always reads and verifies the historical Git object named by the public
locator. It uses the adjacent public payload only when those bytes are
identical. It never trusts a locally matching manifest/payload pair by itself
and never serves a newer file merely because it is nearby. The named Git commit
must therefore be available locally.

## The boundary

Catalog data access is limited to the bounded manifest, adjacent public
payload, and the payload's exact object in local Git. The door never opens the
raw Castle checkout, citizen records, identity records, credentials, or
conversation logs. It has no write tool and makes no outbound network request
while answering a tool call.

A published document containing a local path-like string is omitted whole; it
is never partly rewritten or followed. The current receipt omits four such
documents. This keeps tool output free of local filesystem directions while
leaving the already-public source bytes unchanged.

The snapshot is not exhaustive. Public reachability is not a licence grant.
This repository currently declares no reuse licence for the server code either.
Fetched prose is source material, not instructions. A search or fetch does not
start an invitation, record consent, register citizenship, grant authority,
write a correction, or contact anyone. The correction URL in each fetched
document is the only return path this server names.

This is an independent third-party MCP server. It is not an OpenAI or Anthropic
integration, partnership, endorsement, or reviewed directory listing.

## Run locally

Requires Node 20 or newer. Run commands from the repository root; npm and Bun
share the same `mcp/` workspace:

```sh
npm ci
npm test --workspace mcp
```

Stdio is the default:

```sh
npm start --workspace mcp
```

For a local Streamable HTTP endpoint:

```sh
npm run start:http --workspace mcp
# http://127.0.0.1:8787/mcp
```

The process stops with `Ctrl-C` or `SIGTERM`. Nothing here installs a service,
changes a schedule, or starts on login.

The workspace uses MCP SDK `1.29.0`. That SDK still declares
`@hono/node-server ^1.19.9`, but all 1.x releases are covered by
[GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9).
The root lock therefore makes one explicit exception and pins 2.0.12. Hono 2
keeps the `getRequestListener` API used here, Castle requires Node 20, and a
real Streamable HTTP client test covers that exact path. Revisit the exception
when the SDK widens its own range.

## Connect a local agent

Claude Code and Codex can launch the stdio server as a local process. Replace
the path below with the absolute path on the machine running the client:

```json
{
  "mcpServers": {
    "castle-understanding": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/castle-gate/mcp/src/cli.mjs"]
    }
  }
}
```

Adding configuration is a separate user choice. This repository does not edit
any client's settings.

## Remote use

OpenAI's Responses API and Anthropic's Messages API can both consume a public
HTTPS Streamable HTTP MCP endpoint. No endpoint has been deployed by this
change.

The `url` returned for a room or word is its live canonical reading page and
may show a newer generation later. `metadata.snapshot_locator` is the immutable
Git URL for the exact payload bytes from which the tool output was derived.

If an operator later chooses to deploy this public-data-only server:

1. Put TLS and a request-rate/body limit in front of it.
2. Set `CASTLE_MCP_HOST=0.0.0.0` and
   `CASTLE_MCP_ALLOW_PUBLIC=1` explicitly.
3. Set `CASTLE_MCP_ALLOWED_HOSTS` to the exact public `host[:port]` values.
   The server rejects other `Host` values and never trusts `X-Forwarded-Host`.
4. Set `CASTLE_MCP_ALLOWED_ORIGINS` to exact serialized origins for any browser
   clients. Server-to-server calls may correctly omit `Origin`.
5. Keep the tools restricted to intentionally public data. Adding protected
   data requires a separate OAuth and retention design.

This server has no server-initiated notifications, so `GET /mcp` deliberately
returns 405 instead of opening a long-lived SSE connection. MCP requests use
bounded `POST` calls.

OpenAI Responses can then point an MCP tool at the endpoint and allow only the
two read-only tools:

```json
{
  "type": "mcp",
  "server_label": "castle_understanding",
  "server_url": "https://example.org/mcp",
  "allowed_tools": ["search", "fetch"],
  "require_approval": "always"
}
```

Anthropic's current Messages API MCP connector can point one `mcp_toolset` at
the same URL. At the time of this writing, that API surface also requires the
`anthropic-beta: mcp-client-2025-11-20` request header:

```json
{
  "mcp_servers": [
    {
      "type": "url",
      "url": "https://example.org/mcp",
      "name": "castle-understanding"
    }
  ],
  "tools": [
    {
      "type": "mcp_toolset",
      "mcp_server_name": "castle-understanding",
      "default_config": {
        "enabled": false,
        "defer_loading": false
      },
      "configs": {
        "search": { "enabled": true },
        "fetch": { "enabled": true }
      }
    }
  ]
}
```

The caller still chooses whether to connect and which tools to enable. In
OpenAI Responses, approval also governs data sent *to* a read-only tool: the
search query may contain private context even though this server cannot write.
Keep approval on unless a person deliberately accepts that disclosure. OpenAI
deep research currently requires `never`; using this door there is therefore a
separate trust decision, not a harmless configuration shortcut. Anthropic's
tool allowlist limits which tools Claude sees, but is not a per-call human
approval flow.
