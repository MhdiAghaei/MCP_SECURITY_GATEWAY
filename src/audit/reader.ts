import type { AuditEvent } from "./logger.js";

import { readFile } from "node:fs/promises";

const AUDIT_FILE = "data/audit.jsonl";

export async function readAuditLogs(): Promise<AuditEvent[]> {
  try {
    const content = await readFile(AUDIT_FILE, "utf8");

    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as AuditEvent];
        } catch {
          return [];
        }
      });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}
