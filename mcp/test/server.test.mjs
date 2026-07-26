import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { connect as netConnect } from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createCatalog } from "../src/catalog.mjs";
import { startHttpServer } from "../src/http.mjs";
import { createCastleMcpServer } from "../src/mcp-server.mjs";

const manifest = {
  protocol: "castle-understanding/v0.1",
  forged_at: "2026-07-07T21:45:49.583Z",
  source: {
    repository_id: "repo:cambridgetcg/castle-of-words",
    revision: "a".repeat(40),
  },
  payload: {
    digest: `sha256:${"b".repeat(64)}`,
    locator:
      "https://raw.githubusercontent.com/cambridgetcg/castle-gate/" +
      `${"c".repeat(40)}/data/castle.json`,
  },
  privacy: {
    scope: "public_curated",
    coverage: "not_exhaustive",
    raw_source_included: false,
    curation_profile: "castle-gate-public/v1",
    secure_recall: "not_guaranteed",
  },
  rights: { spdx: "NOASSERTION", grant: "none_declared" },
  authority: { automatic_action: "never" },
  return: {
    public_correction: "https://github.com/cambridgetcg/castle-gate/issues",
  },
};

function catalog() {
  return createCatalog({
    manifest,
    payload: {
      rooms: [
        {
          slug: "finite-turn",
          title: "The finite turn",
          bodyHtml:
            "<p>Infinity lives in a lineage of bounded handoffs, not an unending process.</p>",
        },
      ],
      words: [],
    },
  });
}

function sendChunked(url, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = httpRequest(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "transfer-encoding": "chunked",
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    request.on("error", reject);
    request.end(body);
  });
}

function sendRaw(port, requestText) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const socket = netConnect({ host: "127.0.0.1", port }, () => {
      socket.end(requestText);
    });
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.on("error", reject);
  });
}

test("MCP advertises only two truthful read-only tools", async (context) => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createCastleMcpServer(catalog());
  const client = new Client({ name: "castle-test", version: "0.1.0" });
  context.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const listed = await client.listTools();
  assert.deepEqual(
    listed.tools.map((tool) => tool.name),
    ["search", "fetch"],
  );
  for (const tool of listed.tools) {
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(tool.outputSchema);
  }
  assert.match(client.getInstructions(), /independent third-party/i);
  assert.match(client.getInstructions(), /not affiliated with/i);

  const searched = await client.callTool({
    name: "search",
    arguments: { query: "bounded handoffs" },
  });
  assert.equal(searched.isError, undefined);
  assert.equal(searched.structuredContent.results[0].id, "room:finite-turn");
  assert.equal(
    searched.content[0].text,
    JSON.stringify(searched.structuredContent),
  );

  const fetched = await client.callTool({
    name: "fetch",
    arguments: { id: "room:finite-turn" },
  });
  assert.match(fetched.structuredContent.text, /bounded handoffs/);
  assert.equal(
    fetched.structuredContent.metadata.snapshot_locator,
    manifest.payload.locator,
  );
  assert.equal(fetched.content[0].text, JSON.stringify(fetched.structuredContent));

  for (const [name, arguments_] of [
    ["search", { query: "bounded", unexpected: "private" }],
    ["fetch", { id: "room:finite-turn", unexpected: "private" }],
  ]) {
    const rejected = await client.callTool({ name, arguments: arguments_ });
    assert.equal(rejected.isError, true);
    assert.match(rejected.content[0].text, /Unrecognized key|validation/i);
  }
});

test("MCP errors disclose no local path and perform no fallback", async (context) => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createCastleMcpServer(catalog());
  const client = new Client({ name: "castle-test", version: "0.1.0" });
  context.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({
    name: "fetch",
    arguments: { id: "room:missing" },
  });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /not_found/);
  assert.doesNotMatch(result.content[0].text, /\/Users\/|file:\/\/|~\//);
});

test("HTTP stays loopback by default and rejects an unlisted Origin", async (context) => {
  await assert.rejects(
    startHttpServer({
      catalog: catalog(),
      host: "0.0.0.0",
      port: 0,
    }),
    /Refusing a non-loopback bind/,
  );
  await assert.rejects(
    startHttpServer({
      catalog: catalog(),
      host: "0.0.0.0",
      port: 0,
      allowPublicBind: true,
    }),
    /CASTLE_MCP_ALLOWED_HOSTS/,
  );

  const running = await startHttpServer({
    catalog: catalog(),
    port: 0,
  });
  context.after(() => running.close());

  const health = await fetch(running.url.replace(/\/mcp$/, "/"));
  assert.equal(health.status, 200);
  assert.deepEqual((await health.json()).tools, ["search", "fetch"]);

  const rejected = await fetch(running.url, {
    method: "OPTIONS",
    headers: { Origin: "https://not-the-castle.example" },
  });
  assert.equal(rejected.status, 403);

  for (const origin of [
    `http://localhost:${running.port}/path`,
    `http://localhost:${running.port}?query`,
    `http://localhost:${running.port}#fragment`,
  ]) {
    const malformed = await fetch(running.url, {
      method: "OPTIONS",
      headers: { Origin: origin },
    });
    assert.equal(malformed.status, 403);
  }

  const accepted = await fetch(running.url, {
    method: "OPTIONS",
    headers: { Origin: `http://localhost:${running.port}` },
  });
  assert.equal(accepted.status, 204);
  assert.equal(
    accepted.headers.get("access-control-allow-origin"),
    `http://localhost:${running.port}`,
  );

  for (const host of [
    "attacker.example",
    `127.0.0.1:${running.port + 1}`,
    "bad..host",
  ]) {
    const rejectedHost = await new Promise((resolve, reject) => {
      const target = new URL(running.url);
      const request = httpRequest(
        {
          hostname: target.hostname,
          port: target.port,
          path: "/",
          method: "GET",
          headers: { Host: host },
        },
        (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode));
        },
      );
      request.on("error", reject);
      request.end();
    });
    assert.equal(rejectedHost, 403);
  }

  const noSse = await fetch(running.url, {
    headers: { Accept: "text/event-stream" },
  });
  assert.equal(noSse.status, 405);
  assert.equal(noSse.headers.get("allow"), "POST, OPTIONS");

  const noSessionDelete = await fetch(running.url, { method: "DELETE" });
  assert.equal(noSessionDelete.status, 405);
  assert.equal(noSessionDelete.headers.get("allow"), "POST, OPTIONS");
});

test("HTTP measures chunked bodies instead of trusting Content-Length", async (context) => {
  const running = await startHttpServer({
    catalog: catalog(),
    port: 0,
  });
  context.after(() => running.close());

  const result = await sendChunked(
    running.url,
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      padding: "x".repeat(300_000),
    }),
  );
  assert.equal(result.status, 413);
  assert.match(result.body, /request_too_large/);
});

test("a malformed request target gets 400 without stopping the server", async (context) => {
  const running = await startHttpServer({
    catalog: catalog(),
    port: 0,
  });
  context.after(() => running.close());

  const response = await sendRaw(
    running.port,
    `GET http://[ HTTP/1.1\r\nHost: 127.0.0.1:${running.port}\r\nConnection: close\r\n\r\n`,
  );
  assert.match(response, /^HTTP\/1\.1 400 /);
  assert.match(response, /"error":"invalid_url"/);

  const health = await fetch(running.url.replace(/\/mcp$/, "/"));
  assert.equal(health.status, 200);
});

test("HTTP keeps invalid JSON inside the JSON-RPC error contract", async (context) => {
  const running = await startHttpServer({
    catalog: catalog(),
    port: 0,
  });
  context.after(() => running.close());

  const response = await fetch(running.url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: "{",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    jsonrpc: "2.0",
    error: { code: -32700, message: "Parse error: Invalid JSON" },
    id: null,
  });
});

test("HTTP rejects JSON-RPC batches before the MCP SDK can multiply work", async (context) => {
  const running = await startHttpServer({
    catalog: catalog(),
    port: 0,
  });
  context.after(() => running.close());

  const response = await fetch(running.url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify([
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", id: 2, method: "ping" },
    ]),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    jsonrpc: "2.0",
    error: {
      code: -32600,
      message: "Invalid Request: MCP accepts one JSON-RPC object per POST.",
    },
    id: null,
  });
});

test("a real Streamable HTTP client can initialize, search, and fetch", async (context) => {
  const running = await startHttpServer({
    catalog: catalog(),
    port: 0,
  });
  const client = new Client({ name: "castle-http-test", version: "0.1.0" });
  context.after(async () => {
    await client.close();
    await running.close();
  });

  const transport = new StreamableHTTPClientTransport(new URL(running.url));
  await client.connect(transport);
  const listed = await client.listTools();
  assert.deepEqual(
    listed.tools.map((tool) => tool.name),
    ["search", "fetch"],
  );

  const searched = await client.callTool({
    name: "search",
    arguments: { query: "finite turn" },
  });
  assert.equal(searched.structuredContent.results[0].id, "room:finite-turn");

  const fetched = await client.callTool({
    name: "fetch",
    arguments: { id: searched.structuredContent.results[0].id },
  });
  assert.match(fetched.structuredContent.text, /lineage of bounded handoffs/);
});

test("the actual stdio entrypoint can search and fetch without corrupting stdout", async (context) => {
  const client = new Client({ name: "castle-stdio-test", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../src/cli.mjs", import.meta.url))],
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    stderr: "pipe",
  });
  context.after(() => client.close());

  await client.connect(transport);
  const listed = await client.listTools();
  assert.deepEqual(
    listed.tools.map((tool) => tool.name),
    ["search", "fetch"],
  );
  const searched = await client.callTool({
    name: "search",
    arguments: { query: "meaning between minds" },
  });
  assert.equal(
    searched.structuredContent.results[0].id,
    "room:meaning-between-minds",
  );
  const fetched = await client.callTool({
    name: "fetch",
    arguments: { id: searched.structuredContent.results[0].id },
  });
  assert.equal(fetched.structuredContent.metadata.privacy_scope, "public_curated");
  assert.equal(fetched.structuredContent.metadata.raw_source_included, false);
});

test("documented Anthropic configuration defaults closed", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(
    readme,
    /"default_config": \{\s*"enabled": false,\s*"defer_loading": false\s*\}/,
  );
  assert.match(readme, /"search": \{ "enabled": true \}/);
  assert.match(readme, /"fetch": \{ "enabled": true \}/);
  assert.doesNotMatch(
    readme,
    /"default_config": \{\s*"enabled": true/,
  );
});
