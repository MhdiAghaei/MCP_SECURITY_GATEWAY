import type {
  AuditResponse,
  DashboardStats,
  RiskStats,
  ToolStats,
} from "./types";

const API_BASE = "http://127.0.0.1:7071/api";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getStats(): Promise<DashboardStats> {
  return request<DashboardStats>("/stats");
}

export function getAuditLogs(): Promise<AuditResponse> {
  return request<AuditResponse>("/audit");
}

export function getRiskStats(): Promise<RiskStats> {
  return request<RiskStats>("/stats/risks");
}

export function getToolStats(): Promise<ToolStats> {
  return request<ToolStats>("/stats/tools");
}
