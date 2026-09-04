import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

// ---------------------------------------
// Environment
// ---------------------------------------

const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

// ---------------------------------------
// MCP Client
// ---------------------------------------

const client = new Client({
  name: "security-test-client",
  version: "1.0.0",
});

const transport = new StdioClientTransport({
  command: "npx",

  args: ["tsx", "src/gateway/index.ts"],

  env: {
    ...inheritedEnv,

    MCP_API_KEY: process.env.MCP_API_KEY ?? "",
  },
});

// ---------------------------------------
// Helpers
// ---------------------------------------

function printResult(
  result: Awaited<ReturnType<typeof client.callTool>>,
): void {
  for (const content of result.content) {
    if (content.type === "text") {
      console.log(content.text);
    }
  }
}

// ---------------------------------------
// Main
// ---------------------------------------

async function main(): Promise<void> {
  let connected = false;

  console.log(
    "Client credential:",
    process.env.MCP_API_KEY ? "provided" : "missing",
  );

  try {
    // --------------------------------
    // Connect
    // --------------------------------

    await client.connect(transport);

    connected = true;

    console.log("\nConnected to MCP Security Gateway");

    // --------------------------------
    // Tool Discovery
    // --------------------------------

    const { tools } = await client.listTools();

    console.log("\nAvailable tools:");

    for (const tool of tools) {
      console.log(`- ${tool.name}`);
    }

    // --------------------------------
    // Search
    // --------------------------------

    console.log("\n========== SEARCH ==========");

    const searchResult = await client.callTool({
      name: "search",

      arguments: {
        query: "mug",
      },
    });

    printResult(searchResult);

    // --------------------------------
    // Update Product
    // --------------------------------

    console.log("\n========== UPDATE ==========");

    const updateResult = await client.callTool({
      name: "update-product",

      arguments: {
        id: 2,
        price: 99,
      },
    });

    printResult(updateResult);

    // --------------------------------
    // Delete Product
    // --------------------------------

    console.log("\n========== DELETE ==========");

    const deleteResult = await client.callTool({
      name: "delete-product",

      arguments: {
        id: 3,
      },
    });

    printResult(deleteResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`\nGateway connection failed: ${message}`);

    process.exitCode = 1;
  } finally {
    if (connected) {
      try {
        await client.close();
      } catch {
        // Connection may already be closed.
      }
    }
  }
}

await main();
