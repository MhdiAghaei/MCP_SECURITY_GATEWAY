import type {
  RiskLevel,
  Role,
  SecurityDecision,
  SecurityEventType,
} from "../security/types.js";

import { appendFile, mkdir } from "node:fs/promises";

import { dirname } from "node:path";

interface BaseAuditEvent {
  timestamp: string;
  eventType: SecurityEventType;
  decision: SecurityDecision;
  reason: string;
  durationMs: number;
}

interface ToolAuditEvent extends BaseAuditEvent {
  eventType: "TOOL_ACCESS" | "POLICY_DENIED" | "RATE_LIMIT_EXCEEDED";

  clientId: string;
  clientName: string;
  role: Role;

  tool: string;
  risk: RiskLevel;
}

interface AuthenticationFailedAuditEvent extends BaseAuditEvent {
  eventType: "AUTHENTICATION_FAILED";

  clientId: null;
  clientName: "Unknown";
  role: null;

  tool: "gateway-connect";
  risk: "CRITICAL";
}

export type AuditEvent = ToolAuditEvent | AuthenticationFailedAuditEvent;

const AUDIT_FILE = process.env.MCP_AUDIT_FILE ?? "data/audit.jsonl";

export async function writeAuditLog(event: AuditEvent): Promise<void> {
  await mkdir(dirname(AUDIT_FILE), {
    recursive: true,
  });

  const normalizedEvent = {
    ...event,

    durationMs: Number(event.durationMs.toFixed(2)),
  };

  await appendFile(AUDIT_FILE, `${JSON.stringify(normalizedEvent)}\n`, "utf8");
}
