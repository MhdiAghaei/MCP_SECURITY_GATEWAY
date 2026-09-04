import cors from "cors";
import express from "express";

import { readAuditLogs } from "../audit/reader.js";

const app = express();

const PORT = 7071;

app.use(cors());
app.use(express.json());

// ---------------------------------------
// Health
// ---------------------------------------

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",

    service: "MCP Security Gateway Monitoring API",

    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------
// Audit Logs
// ---------------------------------------

app.get("/api/audit", async (_request, response) => {
  try {
    const logs = await readAuditLogs();

    const sorted = [...logs].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    response.json({
      total: sorted.length,
      logs: sorted,
    });
  } catch {
    response.status(500).json({
      message: "Failed to read audit logs",
    });
  }
});

// ---------------------------------------
// Statistics
// ---------------------------------------

app.get("/api/stats", async (_request, response) => {
  try {
    const logs = await readAuditLogs();

    const allowed = logs.filter((event) => event.decision === "ALLOW").length;

    const denied = logs.filter((event) => event.decision === "DENY").length;

    const authenticationFailed = logs.filter(
      (event) => event.eventType === "AUTHENTICATION_FAILED",
    ).length;

    const policyDenied = logs.filter(
      (event) => event.eventType === "POLICY_DENIED",
    ).length;

    const rateLimitExceeded = logs.filter(
      (event) => event.eventType === "RATE_LIMIT_EXCEEDED",
    ).length;

    const toolAccess = logs.filter(
      (event) => event.eventType === "TOOL_ACCESS",
    ).length;

    const highRisk = logs.filter(
      (event) => event.risk === "HIGH" || event.risk === "CRITICAL",
    ).length;

    const averageDurationMs =
      logs.length === 0
        ? 0
        : logs.reduce((total, event) => total + event.durationMs, 0) /
          logs.length;

    response.json({
      totalRequests: logs.length,

      allowed,
      denied,

      securityEvents: {
        toolAccess,
        policyDenied,
        rateLimitExceeded,
        authenticationFailed,
      },

      highRisk,

      averageDurationMs: Number(averageDurationMs.toFixed(2)),
    });
  } catch {
    response.status(500).json({
      message: "Failed to calculate statistics",
    });
  }
});

// ---------------------------------------
// Risk Distribution
// ---------------------------------------

app.get("/api/stats/risks", async (_request, response) => {
  try {
    const logs = await readAuditLogs();

    const risks = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    for (const log of logs) {
      risks[log.risk] += 1;
    }

    response.json(risks);
  } catch {
    response.status(500).json({
      message: "Failed to calculate risk statistics",
    });
  }
});

// ---------------------------------------
// Tool Statistics
// ---------------------------------------

app.get("/api/stats/tools", async (_request, response) => {
  try {
    const logs = await readAuditLogs();

    const tools = new Map<
      string,
      {
        total: number;
        allowed: number;
        denied: number;
      }
    >();

    for (const log of logs) {
      const current = tools.get(log.tool) ?? {
        total: 0,
        allowed: 0,
        denied: 0,
      };

      current.total += 1;

      if (log.decision === "ALLOW") {
        current.allowed += 1;
      } else {
        current.denied += 1;
      }

      tools.set(log.tool, current);
    }

    response.json(Object.fromEntries(tools));
  } catch {
    response.status(500).json({
      message: "Failed to calculate tool statistics",
    });
  }
});

// ---------------------------------------
// Start
// ---------------------------------------

app.listen(PORT, () => {
  console.log(`Monitoring API running on http://localhost:${PORT}`);
});
