import { createServer } from "node:http";
import { isIP } from "node:net";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createCastleMcpServer } from "./mcp-server.mjs";

const MCP_PATH = "/mcp";
const MCP_METHODS = new Set(["POST"]);
const MCP_ALLOW = "POST, OPTIONS";
const MAX_CONTENT_LENGTH = 256 * 1024;

class RequestBodyError extends Error {
  constructor(status, code) {
    super(code);
    this.name = "RequestBodyError";
    this.status = status;
    this.code = code;
  }
}

function normaliseOrigin(value) {
  if (typeof value !== "string" || !value || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.origin !== value
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(value, port) {
  if (value === undefined || value === "") {
    return new Set([
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
      `http://[::1]:${port}`,
    ]);
  }
  const origins = value.split(",").map(normaliseOrigin);
  if (!origins.length || origins.some((origin) => origin === null)) {
    throw new Error(
      "CASTLE_MCP_ALLOWED_ORIGINS must contain only exact serialized http(s) origins.",
    );
  }
  return new Set(origins);
}

function normalisePort(value) {
  if (value === undefined) return "";
  if (!/^\d{1,5}$/.test(value)) return null;
  const port = Number(value);
  return port <= 65_535 ? `:${port}` : null;
}

function normaliseHost(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value !== value.trim() ||
    value.includes(",") ||
    value.includes("*")
  ) {
    return null;
  }

  if (value.startsWith("[")) {
    const match = value.match(/^\[([^\]]+)\](?::(\d{1,5}))?$/);
    if (!match || isIP(match[1]) !== 6) return null;
    const port = normalisePort(match[2]);
    return port === null ? null : `[${match[1].toLowerCase()}]${port}`;
  }

  const parts = value.split(":");
  if (parts.length > 2) return null;
  const [hostname, rawPort] = parts;
  const port = normalisePort(rawPort);
  if (port === null || !hostname || hostname.includes("..")) return null;
  const validHostname =
    hostname === "localhost" ||
    isIP(hostname) === 4 ||
    hostname.split(".").every(
      (label) =>
        label.length >= 1 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    );
  return validHostname ? `${hostname.toLowerCase()}${port}` : null;
}

export function parseAllowedHosts(value, port) {
  if (value === undefined || value === "") {
    return new Set([
      `127.0.0.1:${port}`,
      `localhost:${port}`,
      `[::1]:${port}`,
    ]);
  }
  const hosts = value.split(",").map(normaliseHost);
  if (!hosts.length || hosts.some((host) => host === null)) {
    throw new Error(
      "CASTLE_MCP_ALLOWED_HOSTS must contain only exact host[:port] authorities.",
    );
  }
  return new Set(hosts);
}

function isAllowedOrigin(request, allowedOrigins) {
  const supplied = request.headers.origin;
  if (supplied === undefined) return { allowed: true, origin: null };
  const origin = normaliseOrigin(supplied);
  return {
    allowed: origin !== null && allowedOrigins.has(origin),
    origin,
  };
}

function isAllowedHost(request, allowedHosts) {
  const host = normaliseHost(request.headers.host);
  return host !== null && allowedHosts.has(host);
}

function writeJson(response, status, value, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(`${JSON.stringify(value)}\n`);
}

function isLoopback(host) {
  return ["127.0.0.1", "::1", "localhost"].includes(host);
}

async function readBoundedJson(request) {
  const chunks = [];
  let bytes = 0;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_CONTENT_LENGTH) {
        throw new RequestBodyError(413, "request_too_large");
      }
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof RequestBodyError) {
      request.resume();
      throw error;
    }
    throw new RequestBodyError(400, "request_body_failed");
  }

  try {
    return JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"));
  } catch {
    throw new RequestBodyError(400, "invalid_json");
  }
}

export async function startHttpServer({
  catalog,
  host = "127.0.0.1",
  port = 8787,
  allowedHosts,
  allowedOrigins,
  allowPublicBind = false,
} = {}) {
  if (!catalog) throw new Error("catalog is required.");
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error("port must be an integer from 0 to 65535.");
  }
  if (!isLoopback(host) && !allowPublicBind) {
    throw new Error(
      "Refusing a non-loopback bind without CASTLE_MCP_ALLOW_PUBLIC=1.",
    );
  }
  if (
    !isLoopback(host) &&
    (allowedHosts === undefined ||
      allowedHosts === "" ||
      (allowedHosts instanceof Set && allowedHosts.size === 0))
  ) {
    throw new Error(
      "Refusing a non-loopback bind without CASTLE_MCP_ALLOWED_HOSTS.",
    );
  }

  let effectiveHosts =
    allowedHosts instanceof Set
      ? new Set([...allowedHosts].map(normaliseHost))
      : parseAllowedHosts(allowedHosts, port);
  if ([...effectiveHosts].some((allowedHost) => allowedHost === null)) {
    throw new Error("allowedHosts contains an invalid host authority.");
  }
  let effectiveOrigins =
    allowedOrigins instanceof Set
      ? allowedOrigins
      : parseAllowedOrigins(allowedOrigins, port);

  const httpServer = createServer(
    { maxHeaderSize: 16 * 1024 },
    async (request, response) => {
      if (!isAllowedHost(request, effectiveHosts)) {
        writeJson(response, 403, { error: "host_not_allowed" });
        return;
      }
      if (!request.url) {
        writeJson(response, 400, { error: "missing_url" });
        return;
      }
      let url;
      try {
        url = new URL(request.url, "http://localhost");
      } catch {
        writeJson(response, 400, { error: "invalid_url" });
        return;
      }

      if (request.method === "GET" && url.pathname === "/") {
        writeJson(response, 200, {
          name: "castle-understanding",
          mode: "read-only",
          endpoint: MCP_PATH,
          tools: ["search", "fetch"],
          source: "receipt-pinned public curated Castle projection",
          affiliation: "independent third-party MCP server",
        });
        return;
      }

      if (url.pathname !== MCP_PATH) {
        writeJson(response, 404, { error: "not_found" });
        return;
      }

      const origin = isAllowedOrigin(request, effectiveOrigins);
      if (!origin.allowed) {
        writeJson(response, 403, { error: "origin_not_allowed" });
        return;
      }
      const corsHeaders = origin.origin
        ? {
            "access-control-allow-origin": origin.origin,
            vary: "Origin",
          }
        : {};

      if (request.method === "OPTIONS") {
        response.writeHead(204, {
          ...corsHeaders,
          "access-control-allow-methods": MCP_ALLOW,
          "access-control-allow-headers":
            "content-type, accept, mcp-protocol-version, mcp-session-id",
          "access-control-expose-headers": "Mcp-Session-Id",
          "access-control-max-age": "600",
        });
        response.end();
        return;
      }
      if (!request.method || !MCP_METHODS.has(request.method)) {
        writeJson(
          response,
          405,
          { error: "method_not_allowed" },
          { allow: MCP_ALLOW, ...corsHeaders },
        );
        return;
      }
      const contentLength = Number(request.headers["content-length"]);
      if (
        Number.isFinite(contentLength) &&
        (contentLength < 0 || contentLength > MAX_CONTENT_LENGTH)
      ) {
        writeJson(response, 413, { error: "request_too_large" }, corsHeaders);
        return;
      }

      let parsedBody;
      if (request.method === "POST") {
        try {
          parsedBody = await readBoundedJson(request);
        } catch (error) {
          const bodyError =
            error instanceof RequestBodyError
              ? error
              : new RequestBodyError(400, "request_body_failed");
          if (bodyError.code === "invalid_json") {
            writeJson(
              response,
              400,
              {
                jsonrpc: "2.0",
                error: { code: -32700, message: "Parse error: Invalid JSON" },
                id: null,
              },
              corsHeaders,
            );
            return;
          }
          writeJson(
            response,
            bodyError.status,
            { error: bodyError.code },
            corsHeaders,
          );
          return;
        }
        if (
          parsedBody === null ||
          typeof parsedBody !== "object" ||
          Array.isArray(parsedBody)
        ) {
          writeJson(
            response,
            400,
            {
              jsonrpc: "2.0",
              error: {
                code: -32600,
                message: "Invalid Request: MCP accepts one JSON-RPC object per POST.",
              },
              id: null,
            },
            corsHeaders,
          );
          return;
        }
      }

      for (const [name, value] of Object.entries(corsHeaders)) {
        response.setHeader(name, value);
      }
      const server = createCastleMcpServer(catalog);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      response.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });

      try {
        await server.connect(transport);
        await transport.handleRequest(request, response, parsedBody);
      } catch {
        if (!response.headersSent) {
          writeJson(response, 500, { error: "mcp_request_failed" }, corsHeaders);
        }
      }
    },
  );
  httpServer.requestTimeout = 30_000;
  httpServer.headersTimeout = 15_000;
  httpServer.keepAliveTimeout = 5_000;

  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, resolve);
  });
  const address = httpServer.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  if (allowedOrigins === undefined && port === 0) {
    effectiveOrigins = parseAllowedOrigins(undefined, actualPort);
  }
  if (allowedHosts === undefined && port === 0) {
    effectiveHosts = parseAllowedHosts(undefined, actualPort);
  }

  return {
    host,
    port: actualPort,
    url: `http://${host.includes(":") ? `[${host}]` : host}:${actualPort}${MCP_PATH}`,
    close: () =>
      new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
        httpServer.closeAllConnections?.();
      }),
  };
}
