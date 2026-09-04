import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

const client = new Client({
  name: "rate-limit-test-client",
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

await client.connect(transport);

for (let requestNumber = 1; requestNumber <= 8; requestNumber++) {
  const result = await client.callTool({
    name: "search",

    arguments: {
      query: "mug",
    },
  });

  console.log(`\nRequest #${requestNumber}`);

  for (const content of result.content) {
    if (content.type === "text") {
      console.log(content.text);
    }
  }
}

await client.close();
