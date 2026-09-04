import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { mkdir, rm, writeFile } from "node:fs/promises";

import { dirname } from "node:path";

// ---------------------------------------
// Config
// ---------------------------------------

const ITERATIONS = 100;
const WARMUP_ITERATIONS = 10;

const RESULT_FILE = "data/benchmark-summary.json";

const BENCHMARK_AUDIT_FILE = "data/benchmark-audit.jsonl";

// ---------------------------------------
// Types
// ---------------------------------------

interface BenchmarkStats {
  count: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
}

interface BenchmarkResult {
  direct: BenchmarkStats;
  gateway: BenchmarkStats;

  overhead: {
    averageMs: number;
    averagePercent: number;
    p95Ms: number;
  };
}

// ---------------------------------------
// Environment
// ---------------------------------------

const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

// ---------------------------------------
// Helpers
// ---------------------------------------

function round(value: number): number {
  return Number(value.toFixed(3));
}

function percentile(values: number[], percent: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);

  const index = Math.max(0, Math.ceil(percent * sorted.length) - 1);

  return sorted[index] ?? 0;
}

function calculateStats(values: number[]): BenchmarkStats {
  if (values.length === 0) {
    return {
      count: 0,
      averageMs: 0,
      minMs: 0,
      maxMs: 0,
      p50Ms: 0,
      p95Ms: 0,
    };
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    count: values.length,

    averageMs: round(total / values.length),

    minMs: round(Math.min(...values)),

    maxMs: round(Math.max(...values)),

    p50Ms: round(percentile(values, 0.5)),

    p95Ms: round(percentile(values, 0.95)),
  };
}

async function executeSearch(client: Client): Promise<number> {
  const startedAt = performance.now();

  const result = await client.callTool({
    name: "search",

    arguments: {
      query: "mug",
    },
  });

  const duration = performance.now() - startedAt;

  if (result.isError) {
    throw new Error("Benchmark search call failed");
  }

  return duration;
}

async function warmup(client: Client): Promise<void> {
  for (let index = 0; index < WARMUP_ITERATIONS; index++) {
    await executeSearch(client);
  }
}

async function collectMeasurements(client: Client): Promise<number[]> {
  const measurements: number[] = [];

  for (let index = 0; index < ITERATIONS; index++) {
    const duration = await executeSearch(client);

    measurements.push(duration);
  }

  return measurements;
}

// ---------------------------------------
// Direct MCP Benchmark
// ---------------------------------------

async function benchmarkDirect(): Promise<BenchmarkStats> {
  console.log("\nBenchmarking DIRECT MCP...");

  const client = new Client({
    name: "direct-benchmark-client",

    version: "1.0.0",
  });

  const transport = new StdioClientTransport({
    command: "npx",

    args: ["tsx", "src/servers/catalog-server.ts"],
  });

  try {
    await client.connect(transport);

    console.log(`Warmup: ${WARMUP_ITERATIONS}`);

    await warmup(client);

    console.log(`Measurements: ${ITERATIONS}`);

    const measurements = await collectMeasurements(client);

    return calculateStats(measurements);
  } finally {
    await client.close();
  }
}

// ---------------------------------------
// Gateway Benchmark
// ---------------------------------------

async function benchmarkGateway(): Promise<BenchmarkStats> {
  console.log("\nBenchmarking SECURITY GATEWAY...");

  const client = new Client({
    name: "gateway-benchmark-client",

    version: "1.0.0",
  });

  const transport = new StdioClientTransport({
    command: "npx",

    args: ["tsx", "src/gateway/index.ts"],

    env: {
      ...inheritedEnv,

      MCP_API_KEY: "viewer-secret-key",

      MCP_RATE_LIMIT_MAX_REQUESTS: "10000",

      MCP_RATE_LIMIT_WINDOW_MS: "60000",

      MCP_AUDIT_FILE: BENCHMARK_AUDIT_FILE,
    },
  });

  try {
    await client.connect(transport);

    console.log(`Warmup: ${WARMUP_ITERATIONS}`);

    await warmup(client);

    console.log(`Measurements: ${ITERATIONS}`);

    const measurements = await collectMeasurements(client);

    return calculateStats(measurements);
  } finally {
    await client.close();
  }
}

// ---------------------------------------
// Main
// ---------------------------------------

async function main(): Promise<void> {
  console.log("\n========================================");

  console.log("MCP SECURITY GATEWAY PERFORMANCE TEST");

  console.log("========================================");

  console.log(`Iterations: ${ITERATIONS}`);

  console.log(`Warmup iterations: ${WARMUP_ITERATIONS}`);

  await rm(BENCHMARK_AUDIT_FILE, {
    force: true,
  });

  const direct = await benchmarkDirect();

  const gateway = await benchmarkGateway();

  const averageOverhead = gateway.averageMs - direct.averageMs;

  const p95Overhead = gateway.p95Ms - direct.p95Ms;

  const averagePercent =
    direct.averageMs === 0 ? 0 : (averageOverhead / direct.averageMs) * 100;

  const result: BenchmarkResult = {
    direct,

    gateway,

    overhead: {
      averageMs: round(averageOverhead),

      averagePercent: round(averagePercent),

      p95Ms: round(p95Overhead),
    },
  };

  await mkdir(dirname(RESULT_FILE), {
    recursive: true,
  });

  await writeFile(
    RESULT_FILE,

    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),

        iterations: ITERATIONS,

        warmupIterations: WARMUP_ITERATIONS,

        ...result,
      },
      null,
      2,
    ),

    "utf8",
  );

  console.log("\n========================================");

  console.log("BENCHMARK RESULT");

  console.log("========================================");

  console.log("\nDIRECT MCP");

  console.table(direct);

  console.log("\nSECURITY GATEWAY");

  console.table(gateway);

  console.log("\nGATEWAY OVERHEAD");

  console.log(`Average overhead: ${result.overhead.averageMs} ms`);

  console.log(`Average overhead: ${result.overhead.averagePercent}%`);

  console.log(`P95 overhead: ${result.overhead.p95Ms} ms`);

  console.log(`\nResult saved to ${RESULT_FILE}`);
}

await main();
