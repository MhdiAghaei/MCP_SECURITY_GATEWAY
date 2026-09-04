import type { AuditEvent } from "../audit/logger.js";

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";

import { dirname } from "node:path";

import { readAuditLogs } from "../audit/reader.js";

// ---------------------------------------
// Config
// ---------------------------------------

const AUDIT_FILE = "data/audit.jsonl";

const SUMMARY_FILE = "data/scenario-summary.json";

// ---------------------------------------
// Types
// ---------------------------------------

interface ScenarioResult {
  name: string;
  passed: boolean;
  generatedEvents: number;
  message: string;
}

interface Scenario {
  name: string;
  script: string;
  expectedExitCodes: number[];
  validate: (events: AuditEvent[]) => {
    passed: boolean;
    message: string;
  };
}

// ---------------------------------------
// Helpers
// ---------------------------------------

function runNpmScript(
  script: string,
  expectedExitCodes: number[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n========================================`);

    console.log(`Running: npm run ${script}`);

    console.log(`========================================\n`);

    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

    const child = spawn(npmCommand, ["run", script], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      const exitCode = code ?? 1;

      if (expectedExitCodes.includes(exitCode)) {
        resolve();
        return;
      }

      reject(new Error(`Scenario "${script}" exited with code ${exitCode}`));
    });
  });
}

function findEvent(
  events: AuditEvent[],
  tool: string,
  decision: "ALLOW" | "DENY",
): boolean {
  return events.some(
    (event) => event.tool === tool && event.decision === decision,
  );
}

function countEventType(
  events: AuditEvent[],
  eventType: AuditEvent["eventType"],
): number {
  return events.filter((event) => event.eventType === eventType).length;
}

// ---------------------------------------
// Scenario definitions
// ---------------------------------------

const scenarios: Scenario[] = [
  // -----------------------------------
  // Viewer
  // -----------------------------------

  {
    name: "Viewer RBAC",
    script: "client:viewer",
    expectedExitCodes: [0],

    validate(events) {
      const passed =
        events.length === 3 &&
        findEvent(events, "search", "ALLOW") &&
        findEvent(events, "update-product", "DENY") &&
        findEvent(events, "delete-product", "DENY");

      return {
        passed,

        message: "viewer: search=ALLOW, update=DENY, delete=DENY",
      };
    },
  },

  // -----------------------------------
  // Developer
  // -----------------------------------

  {
    name: "Developer RBAC",
    script: "client:developer",

    expectedExitCodes: [0],

    validate(events) {
      const passed =
        events.length === 3 &&
        findEvent(events, "search", "ALLOW") &&
        findEvent(events, "update-product", "ALLOW") &&
        findEvent(events, "delete-product", "DENY");

      return {
        passed,

        message: "developer: search=ALLOW, update=ALLOW, delete=DENY",
      };
    },
  },

  // -----------------------------------
  // Admin
  // -----------------------------------

  {
    name: "Admin RBAC",
    script: "client:admin",
    expectedExitCodes: [0],

    validate(events) {
      const passed =
        events.length === 3 &&
        findEvent(events, "search", "ALLOW") &&
        findEvent(events, "update-product", "ALLOW") &&
        findEvent(events, "delete-product", "ALLOW");

      return {
        passed,

        message: "admin: search=ALLOW, update=ALLOW, delete=ALLOW",
      };
    },
  },

  // -----------------------------------
  // Invalid Credential
  // -----------------------------------

  {
    name: "Invalid Authentication",

    script: "client:invalid",

    // Failure is expected here.
    expectedExitCodes: [0, 1],

    validate(events) {
      const authFailures = countEventType(events, "AUTHENTICATION_FAILED");

      return {
        passed: events.length === 1 && authFailures === 1,

        message: "invalid API key rejected",
      };
    },
  },

  // -----------------------------------
  // Rate Limiting
  // -----------------------------------

  {
    name: "Rate Limit Protection",

    script: "test:rate-limit",

    expectedExitCodes: [0],

    validate(events) {
      const allowed = countEventType(events, "TOOL_ACCESS");

      const blocked = countEventType(events, "RATE_LIMIT_EXCEEDED");

      return {
        passed: events.length === 8 && allowed === 5 && blocked === 3,

        message: `allowed=${allowed}, rateLimited=${blocked}`,
      };
    },
  },
];

// ---------------------------------------
// Summary
// ---------------------------------------

function createSummary(logs: AuditEvent[], scenarioResults: ScenarioResult[]) {
  const eventCounts = {
    TOOL_ACCESS: countEventType(logs, "TOOL_ACCESS"),

    POLICY_DENIED: countEventType(logs, "POLICY_DENIED"),

    RATE_LIMIT_EXCEEDED: countEventType(logs, "RATE_LIMIT_EXCEEDED"),

    AUTHENTICATION_FAILED: countEventType(logs, "AUTHENTICATION_FAILED"),
  };

  const allowed = logs.filter((log) => log.decision === "ALLOW").length;

  const denied = logs.filter((log) => log.decision === "DENY").length;

  const risks = {
    LOW: logs.filter((log) => log.risk === "LOW").length,

    MEDIUM: logs.filter((log) => log.risk === "MEDIUM").length,

    HIGH: logs.filter((log) => log.risk === "HIGH").length,

    CRITICAL: logs.filter((log) => log.risk === "CRITICAL").length,
  };

  const allPassed = scenarioResults.every((result) => result.passed);

  return {
    generatedAt: new Date().toISOString(),

    allPassed,

    totalEvents: logs.length,

    allowed,
    denied,

    eventCounts,

    risks,

    scenarios: scenarioResults,
  };
}

// ---------------------------------------
// Main
// ---------------------------------------

async function main(): Promise<void> {
  console.log("\nMCP Security Gateway");

  console.log("Automated Security Test Suite\n");

  // -----------------------------------
  // Reset previous dataset
  // -----------------------------------

  await rm(AUDIT_FILE, {
    force: true,
  });

  console.log("Previous audit dataset cleared.");

  const results: ScenarioResult[] = [];

  let previousLogCount = 0;

  // -----------------------------------
  // Run scenarios
  // -----------------------------------

  for (const scenario of scenarios) {
    try {
      await runNpmScript(scenario.script, scenario.expectedExitCodes);

      const logs = await readAuditLogs();

      const generatedEvents = logs.slice(previousLogCount);

      previousLogCount = logs.length;

      const validation = scenario.validate(generatedEvents);

      results.push({
        name: scenario.name,

        passed: validation.passed,

        generatedEvents: generatedEvents.length,

        message: validation.message,
      });

      console.log(
        validation.passed
          ? `\n✅ ${scenario.name} PASSED`
          : `\n❌ ${scenario.name} FAILED`,
      );

      console.log(validation.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      results.push({
        name: scenario.name,

        passed: false,

        generatedEvents: 0,

        message,
      });

      console.error(`\n❌ ${scenario.name} FAILED`);

      console.error(message);
    }
  }

  // -----------------------------------
  // Final Dataset
  // -----------------------------------

  const logs = await readAuditLogs();

  const summary = createSummary(logs, results);

  await mkdir(dirname(SUMMARY_FILE), {
    recursive: true,
  });

  await writeFile(
    SUMMARY_FILE,

    JSON.stringify(summary, null, 2),

    "utf8",
  );

  // -----------------------------------
  // Result
  // -----------------------------------

  console.log("\n========================================");

  console.log("FINAL SECURITY TEST SUMMARY");

  console.log("========================================");

  for (const result of results) {
    console.log(`${result.passed ? "✅" : "❌"} ${result.name}`);
  }

  console.log("\nTotal events:", summary.totalEvents);

  console.log("Allowed:", summary.allowed);

  console.log("Denied:", summary.denied);

  console.log("\nEvent counts:", summary.eventCounts);

  console.log("\nRisk distribution:", summary.risks);

  console.log(`\nDataset: ${AUDIT_FILE}`);

  console.log(`Summary: ${SUMMARY_FILE}`);

  if (!summary.allPassed) {
    process.exitCode = 1;

    console.error("\n❌ Security test suite FAILED");

    return;
  }

  console.log("\n✅ ALL SECURITY TESTS PASSED");
}

await main();
