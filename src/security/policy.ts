import type { RiskLevel, Role, SecurityDecision } from "./types.js";

interface ToolPolicy {
  risk: RiskLevel;
  allowedRoles: Role[];
}

const toolPolicies: Record<string, ToolPolicy> = {
  search: {
    risk: "LOW",
    allowedRoles: ["viewer", "developer", "admin"],
  },

  "update-product": {
    risk: "MEDIUM",
    allowedRoles: ["developer", "admin"],
  },

  "delete-product": {
    risk: "HIGH",
    allowedRoles: ["admin"],
  },
};

export function evaluateToolAccess(
  role: Role,
  toolName: string,
): {
  decision: SecurityDecision;
  risk: RiskLevel;
  reason: string;
} {
  const policy = toolPolicies[toolName];

  if (!policy) {
    return {
      decision: "DENY",
      risk: "CRITICAL",
      reason: `No security policy exists for tool "${toolName}"`,
    };
  }

  if (!policy.allowedRoles.includes(role)) {
    return {
      decision: "DENY",
      risk: policy.risk,
      reason: `Role "${role}" is not allowed to execute "${toolName}"`,
    };
  }

  return {
    decision: "ALLOW",
    risk: policy.risk,
    reason: `Role "${role}" is allowed to execute "${toolName}"`,
  };
}
