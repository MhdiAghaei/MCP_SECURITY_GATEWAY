export type Role =
	| "viewer"
	| "developer"
	| "admin";

export type RiskLevel =
	| "LOW"
	| "MEDIUM"
	| "HIGH"
	| "CRITICAL";

export type SecurityDecision =
	| "ALLOW"
	| "DENY";

export type SecurityEventType =
	| "TOOL_ACCESS"
	| "POLICY_DENIED"
	| "RATE_LIMIT_EXCEEDED"
	| "AUTHENTICATION_FAILED";

export interface AuditEvent {
	timestamp: string;
	eventType: SecurityEventType;

	clientId: string | null;
	clientName: string;

	role: Role | null;

	tool: string;
	risk: RiskLevel;

	decision: SecurityDecision;
	reason: string;

	durationMs: number;
}

export interface AuditResponse {
	total: number;
	logs: AuditEvent[];
}

export interface SecurityEvents {
	toolAccess: number;
	policyDenied: number;
	rateLimitExceeded: number;
	authenticationFailed: number;
}

export interface DashboardStats {
	totalRequests: number;
	allowed: number;
	denied: number;

	securityEvents: SecurityEvents;

	highRisk: number;
	averageDurationMs: number;
}

export interface RiskStats {
	LOW: number;
	MEDIUM: number;
	HIGH: number;
	CRITICAL: number;
}

export interface ToolStatsItem {
	total: number;
	allowed: number;
	denied: number;
}

export type ToolStats =
	Record<string, ToolStatsItem>;