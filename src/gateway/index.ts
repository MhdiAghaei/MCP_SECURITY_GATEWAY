import type { AuthenticatedClient } from "../auth/api-key.js";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import * as z from "zod/v4";

import { writeAuditLog } from "../audit/logger.js";
import { authenticateApiKey } from "../auth/api-key.js";
import { evaluateToolAccess } from "../security/policy.js";
import { checkRateLimit } from "../security/rate-limiter.js";

// ---------------------------------------
// Authentication
// ---------------------------------------

async function requireAuthentication(): Promise<AuthenticatedClient> {
  const startedAt = performance.now();

  const identity = authenticateApiKey(process.env.MCP_API_KEY);

  if (!identity) {
    await writeAuditLog({
      timestamp: new Date().toISOString(),

      eventType: "AUTHENTICATION_FAILED",

      clientId: null,
      clientName: "Unknown",
      role: null,

      tool: "gateway-connect",

      risk: "CRITICAL",

      decision: "DENY",

      reason: "Invalid or missing API key",

      durationMs: performance.now() - startedAt,
    });

    throw new Error("Authentication failed: invalid or missing API key");
  }

  return identity;
}
let identity: AuthenticatedClient;

try {
  identity = await requireAuthentication();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);

  process.exit(1);
}
const role = identity.role;

console.error(`Authenticated client: ${identity.name}`);

console.error(`Resolved role: ${role}`);

// ---------------------------------------
// Downstream MCP Client
// ---------------------------------------

const catalogClient = new Client({
  name: "mcp-security-gateway",
  version: "1.0.0",
});

const catalogTransport = new StdioClientTransport({
  command: "npx",

  args: ["tsx", "src/servers/catalog-server.ts"],
});

await catalogClient.connect(catalogTransport);

console.error("Gateway connected to Catalog MCP");

// ---------------------------------------
// Cleanup
// ---------------------------------------

let isShuttingDown = false;

async function shutdown(): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.error("Shutting down MCP Security Gateway...");

  await catalogClient.close();
}

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

process.stdin.on("end", async () => {
  await shutdown();
});

// ---------------------------------------
// Tool Discovery
// ---------------------------------------

const { tools } = await catalogClient.listTools();

console.error(
  "Discovered downstream tools:",
  tools.map((tool) => tool.name),
);

// ---------------------------------------
// Gateway Server
// ---------------------------------------

function createGatewayServer(): McpServer {
  const server = new McpServer({
    name: "mcp-security-gateway",
    version: "1.0.0",
  });

  // =======================================
  // SEARCH
  // =======================================

  server.registerTool(
    "search",

    {
      description: "Securely search the product catalog",

      inputSchema: z.object({
        query: z.string(),

        limit: z.number().int().min(1).max(50).optional(),
      }),
    },

    async ({ query, limit }) => {
      const startedAt = performance.now();

      const security = evaluateToolAccess(role, "search");

      const rateLimit = checkRateLimit(identity.id);

      // -----------------------------
      // Rate Limit
      // -----------------------------

      if (!rateLimit.allowed) {
        await writeAuditLog({
          timestamp: new Date().toISOString(),

          eventType: "RATE_LIMIT_EXCEEDED",

          clientId: identity.id,

          clientName: identity.name,

          role,

          tool: "search",

          risk: security.risk,

          decision: "DENY",

          reason: `Rate limit exceeded. Retry after ${rateLimit.retryAfterMs}ms`,

          durationMs: performance.now() - startedAt,
        });

        return {
          content: [
            {
              type: "text",

              text:
                "Rate limit exceeded.\n" +
                `Retry after ${rateLimit.retryAfterMs}ms`,
            },
          ],

          isError: true,
        };
      }

      // -----------------------------
      // Policy
      // -----------------------------

      if (security.decision === "DENY") {
        await writeAuditLog({
          timestamp: new Date().toISOString(),

          eventType: "POLICY_DENIED",

          clientId: identity.id,

          clientName: identity.name,

          role,

          tool: "search",

          risk: security.risk,

          decision: security.decision,

          reason: security.reason,

          durationMs: performance.now() - startedAt,
        });

        return {
          content: [
            {
              type: "text",

              text: `Access denied: ${security.reason}`,
            },
          ],

          isError: true,
        };
      }

      // -----------------------------
      // Downstream Call
      // -----------------------------

      const result = await catalogClient.callTool({
        name: "search",

        arguments: {
          query,
          limit,
        },
      });

      await writeAuditLog({
        timestamp: new Date().toISOString(),

        eventType: "TOOL_ACCESS",

        clientId: identity.id,

        clientName: identity.name,

        role,

        tool: "search",

        risk: security.risk,

        decision: security.decision,

        reason: security.reason,

        durationMs: performance.now() - startedAt,
      });

      return {
        content: result.content,

        isError: result.isError,
      };
    },
  );

  // =======================================
  // UPDATE PRODUCT
  // =======================================

  server.registerTool(
    "update-product",

    {
      description: "Securely update an existing product",

      inputSchema: z.object({
        id: z.number().int().positive(),

        name: z.string().min(1).optional(),

        price: z.number().positive().optional(),
      }),
    },

    async ({ id, name, price }) => {
      const startedAt = performance.now();

      const security = evaluateToolAccess(role, "update-product");

      const rateLimit = checkRateLimit(identity.id);

      // -----------------------------
      // Rate Limit
      // -----------------------------

      if (!rateLimit.allowed) {
        await writeAuditLog({
          timestamp: new Date().toISOString(),

          eventType: "RATE_LIMIT_EXCEEDED",

          clientId: identity.id,

          clientName: identity.name,

          role,

          tool: "update-product",

          risk: security.risk,

          decision: "DENY",

          reason: `Rate limit exceeded. Retry after ${rateLimit.retryAfterMs}ms`,

          durationMs: performance.now() - startedAt,
        });

        return {
          content: [
            {
              type: "text",

              text:
                "Rate limit exceeded.\n" +
                `Retry after ${rateLimit.retryAfterMs}ms`,
            },
          ],

          isError: true,
        };
      }

      // -----------------------------
      // Policy
      // -----------------------------

      if (security.decision === "DENY") {
        await writeAuditLog({
          timestamp: new Date().toISOString(),

          eventType: "POLICY_DENIED",

          clientId: identity.id,

          clientName: identity.name,

          role,

          tool: "update-product",

          risk: security.risk,

          decision: security.decision,

          reason: security.reason,

          durationMs: performance.now() - startedAt,
        });

        return {
          content: [
            {
              type: "text",

              text:
                "MCP Security Gateway blocked this request.\n" +
                `Reason: ${security.reason}`,
            },
          ],

          isError: true,
        };
      }

      // -----------------------------
      // Downstream Call
      // -----------------------------

      const result = await catalogClient.callTool({
        name: "update-product",

        arguments: {
          id,
          name,
          price,
        },
      });

      await writeAuditLog({
        timestamp: new Date().toISOString(),

        eventType: "TOOL_ACCESS",

        clientId: identity.id,

        clientName: identity.name,

        role,

        tool: "update-product",

        risk: security.risk,

        decision: security.decision,

        reason: security.reason,

        durationMs: performance.now() - startedAt,
      });

      return {
        content: result.content,

        isError: result.isError,
      };
    },
  );

  // =======================================
  // DELETE PRODUCT
  // =======================================

  server.registerTool(
    "delete-product",

    {
      description: "Securely delete a product",

      inputSchema: z.object({
        id: z.number().int().positive(),
      }),
    },

    async ({ id }) => {
      const startedAt = performance.now();

      const security = evaluateToolAccess(role, "delete-product");

      const rateLimit = checkRateLimit(identity.id);

      // -----------------------------
      // Rate Limit
      // -----------------------------

      if (!rateLimit.allowed) {
        await writeAuditLog({
          timestamp: new Date().toISOString(),

          eventType: "RATE_LIMIT_EXCEEDED",

          clientId: identity.id,

          clientName: identity.name,

          role,

          tool: "delete-product",

          risk: security.risk,

          decision: "DENY",

          reason: `Rate limit exceeded. Retry after ${rateLimit.retryAfterMs}ms`,

          durationMs: performance.now() - startedAt,
        });

        return {
          content: [
            {
              type: "text",

              text:
                "Rate limit exceeded.\n" +
                `Retry after ${rateLimit.retryAfterMs}ms`,
            },
          ],

          isError: true,
        };
      }

      // -----------------------------
      // Policy
      // -----------------------------

      if (security.decision === "DENY") {
        await writeAuditLog({
          timestamp: new Date().toISOString(),

          eventType: "POLICY_DENIED",

          clientId: identity.id,

          clientName: identity.name,

          role,

          tool: "delete-product",

          risk: security.risk,

          decision: security.decision,

          reason: security.reason,

          durationMs: performance.now() - startedAt,
        });

        return {
          content: [
            {
              type: "text",

              text:
                "MCP Security Gateway blocked this request.\n" +
                `Reason: ${security.reason}`,
            },
          ],

          isError: true,
        };
      }

      // -----------------------------
      // Downstream Call
      // -----------------------------

      const result = await catalogClient.callTool({
        name: "delete-product",

        arguments: {
          id,
        },
      });

      await writeAuditLog({
        timestamp: new Date().toISOString(),

        eventType: "TOOL_ACCESS",

        clientId: identity.id,

        clientName: identity.name,

        role,

        tool: "delete-product",

        risk: security.risk,

        decision: security.decision,

        reason: security.reason,

        durationMs: performance.now() - startedAt,
      });

      return {
        content: result.content,

        isError: result.isError,
      };
    },
  );

  return server;
}

// ---------------------------------------
// Start Gateway
// ---------------------------------------

void serveStdio(createGatewayServer);

console.error("MCP Security Gateway running");
