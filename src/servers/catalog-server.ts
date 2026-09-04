import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

interface Product {
  id: number;
  name: string;
  price: number;
}

const catalog: Product[] = [
  {
    id: 1,
    name: "Espresso cup",
    price: 12,
  },
  {
    id: 2,
    name: "Travel mug",
    price: 24,
  },
  {
    id: 3,
    name: "Mug rack",
    price: 36,
  },
];

function createServer(): McpServer {
  const server = new McpServer({
    name: "catalog-server",
    version: "1.0.0",
  });

  // LOW RISK
  server.registerTool(
    "search",
    {
      description: "Search products in catalog",

      inputSchema: z.object({
        query: z.string(),

        limit: z.number().int().min(1).max(50).optional(),
      }),
    },

    async ({ query, limit }) => {
      const products = catalog
        .filter((product) =>
          product.name.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, limit ?? 10);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(products, null, 2),
          },
        ],
      };
    },
  );

  // HIGH RISK
  server.registerTool(
    "delete-product",
    {
      description: "Delete a product from catalog",

      inputSchema: z.object({
        id: z.number().int().positive(),
      }),
    },

    async ({ id }) => {
      const index = catalog.findIndex((product) => product.id === id);

      if (index === -1) {
        return {
          content: [
            {
              type: "text",
              text: `Product ${id} not found`,
            },
          ],

          isError: true,
        };
      }

      const [deletedProduct] = catalog.splice(index, 1);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: "Product deleted",
              product: deletedProduct,
            }),
          },
        ],
      };
    },
  );
  server.registerTool(
    "update-product",
    {
      description: "Update an existing product",

      inputSchema: z.object({
        id: z.number().int().positive(),

        name: z.string().min(1).optional(),

        price: z.number().positive().optional(),
      }),
    },

    async ({ id, name, price }) => {
      const product = catalog.find((item) => item.id === id);

      if (!product) {
        return {
          content: [
            {
              type: "text",
              text: `Product with id ${id} not found`,
            },
          ],
          isError: true,
        };
      }

      if (name === undefined && price === undefined) {
        return {
          content: [
            {
              type: "text",
              text: "At least one field must be provided for update",
            },
          ],
          isError: true,
        };
      }

      if (name !== undefined) {
        product.name = name;
      }

      if (price !== undefined) {
        product.price = price;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Product updated successfully",
                product,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
  return server;
}

void serveStdio(createServer);

console.error("Catalog MCP server running on stdio");
