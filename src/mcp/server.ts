import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ServiceClient } from "./api-client.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

const SERVICE_URL = process.env.SERVICE_URL ?? "http://localhost:3000";

const mcpServer = new McpServer(
  {
    name: "medical-appointments",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
    instructions: `You are a medical appointment assistant. You can help patients:
- Search for doctors by specialty or name
- Check available appointment time slots
- Book and cancel appointments
- Review patient history
- Get specialist recommendations based on symptoms

Use the available tools and resources to help users manage their medical appointments.
The appointment service runs at ${SERVICE_URL}.`,
  }
);

const client = new ServiceClient(SERVICE_URL);
const lowLevelServer = mcpServer.server;

// Register all MCP primitives
registerTools(mcpServer, lowLevelServer, client);
registerResources(mcpServer, client);
registerPrompts(mcpServer, client);

// Handle roots listing (client feature demo)
lowLevelServer.setRequestHandler(
  { method: "roots/list" } as any,
  async () => {
    return {
      roots: [
        {
          uri: "file:///medical-appointments",
          name: "Medical Appointments Service",
        },
      ],
    };
  }
);

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error(`MCP server "medical-appointments" running on stdio`);
  console.error(`Service URL: ${SERVICE_URL}`);
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
