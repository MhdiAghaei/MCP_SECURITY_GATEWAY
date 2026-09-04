export type Role = "viewer" | "developer" | "admin";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SecurityDecision = "ALLOW" | "DENY";

export type SecurityEventType =
  | "TOOL_ACCESS"
  | "POLICY_DENIED"
  | "RATE_LIMIT_EXCEEDED"
  | "AUTHENTICATION_FAILED";
