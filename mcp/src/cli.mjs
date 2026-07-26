#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadReceiptPinnedCatalog } from "./catalog.mjs";
import { startHttpServer } from "./http.mjs";
import { createCastleMcpServer } from "./mcp-server.mjs";

function usage() {
  return [
    "usage: node src/cli.mjs [--stdio|--http]",
    "",
    "Default: stdio MCP on stdin/stdout.",
    "HTTP:    loopback only at http://127.0.0.1:8787/mcp.",
    "",
    "HTTP environment:",
    "  CASTLE_MCP_HOST=127.0.0.1",
    "  CASTLE_MCP_PORT=8787",
    "  CASTLE_MCP_ALLOWED_HOSTS=localhost:8787",
    "  CASTLE_MCP_ALLOWED_ORIGINS=http://localhost:3000",
    "  CASTLE_MCP_ALLOW_PUBLIC=1  # required for a non-loopback bind",
  ].join("\n");
}

function parsePort(value) {
  if (!/^\d{1,5}$/.test(value ?? "")) {
    throw new Error("CASTLE_MCP_PORT must be an integer from 0 to 65535.");
  }
  const port = Number(value);
  if (port > 65_535) {
    throw new Error("CASTLE_MCP_PORT must be an integer from 0 to 65535.");
  }
  return port;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (
    args.some((arg) => !["--stdio", "--http"].includes(arg)) ||
    (args.includes("--stdio") && args.includes("--http"))
  ) {
    throw new Error(usage());
  }

  const catalog = loadReceiptPinnedCatalog();
  if (args.includes("--http")) {
    const host = process.env.CASTLE_MCP_HOST || "127.0.0.1";
    const port = parsePort(process.env.CASTLE_MCP_PORT || "8787");
    const running = await startHttpServer({
      catalog,
      host,
      port,
      allowedHosts: process.env.CASTLE_MCP_ALLOWED_HOSTS,
      allowedOrigins: process.env.CASTLE_MCP_ALLOWED_ORIGINS,
      allowPublicBind: process.env.CASTLE_MCP_ALLOW_PUBLIC === "1",
    });
    process.stderr.write(
      `Castle understanding MCP listening at ${running.url}; ` +
        `${catalog.size} public documents, ${catalog.omittedDocuments} omitted by policy.\n`,
    );

    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await running.close();
    };
    process.once("SIGINT", () => close().finally(() => process.exit(0)));
    process.once("SIGTERM", () => close().finally(() => process.exit(0)));
    return;
  }

  const server = createCastleMcpServer(catalog);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(
    `castle-understanding-mcp: ${
      error instanceof Error ? error.message : "unknown failure"
    }\n`,
  );
  process.exitCode = 1;
});
