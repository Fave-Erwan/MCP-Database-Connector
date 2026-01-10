import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initializeDatabase } from "./db/client.js";
import { queryDatabaseTool, listTables } from "./tools/handlers.js";
import { execute_write_query } from "./tools/execute_write_query.js";
import { admin_list_permissions, admin_toggle_permission } from "./tools/admin.js";
import { sanitizeError } from "./middleware/guards.js";
import dotenv from "dotenv";

dotenv.config();

const server = new Server(
  { name: process.env.MCP_SERVER_NAME || "mcp-database-connector", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 1. Déclaration des outils à l'IA
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "query_db",
      description: "Exécute une requête SQL (SELECT, ou modifications si autorisé).",
      inputSchema: {
        type: "object",
        properties: {
          sql: { type: "string", description: "La requête SQL complète" },
        },
        required: ["sql"],
      },
    },
    {
      name: "list_tables",
      description: "Retourne la liste des tables disponibles dans la base de données.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "admin_list_permissions",
      description: "Retourne la liste des tables et leur statut de permission (admin).",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "admin_toggle_permission",
      description: "Met à jour la permission d'une table (admin). permission_type: 'read' | 'write'.",
      inputSchema: {
        type: "object",
        properties: {
          table_name: { type: 'string' },
          permission_type: { type: 'string', enum: ['read','write'] },
          status: { type: 'boolean' },
        },
        required: ['table_name','permission_type','status'],
      },
    },
    {
      name: "execute_write_query",
      description: "Exécute une requête d'écriture (INSERT/UPDATE/DELETE/CREATE/DROP) via le vigile.",
      inputSchema: {
        type: 'object',
        properties: {
          sql: { type: 'string' }
        },
        required: ['sql']
      }
    },
  ],
}));

// 2. Exécution des outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query_db") {
    const sql = request.params.arguments?.sql as string;

    try {
      const result = await queryDatabaseTool(sql);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `ERREUR : ${sanitizeError(error)}` }],
      };
    }
  }

  if (request.params.name === "list_tables") {
    try {
      const tables = await listTables();
      return {
        content: [{ type: "text", text: JSON.stringify(tables, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `ERREUR : ${sanitizeError(error)}` }],
      };
    }
  }

  if (request.params.name === "admin_list_permissions") {
    try {
      const perms = await admin_list_permissions();
      return {
        content: [{ type: "text", text: JSON.stringify(perms, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `ERREUR : ${sanitizeError(error)}` }],
      };
    }
  }

  if (request.params.name === "admin_toggle_permission") {
    try {
      const table_name = request.params.arguments?.table_name as string;
      const permission_type = request.params.arguments?.permission_type as 'read' | 'write';
      const status = request.params.arguments?.status as boolean;
      const res = await admin_toggle_permission(table_name, permission_type, status);
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `ERREUR : ${sanitizeError(error)}` }],
      };
    }
  }

  if (request.params.name === "execute_write_query") {
    try {
      const sql = request.params.arguments?.sql as string;
      const result = await execute_write_query(sql);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `ERREUR : ${sanitizeError(error)}` }],
      };
    }
  }

  throw new Error("Outil non trouvé");
});

// 3. Démarrage
async function main() {
  await initializeDatabase(); // On initialise la BDD avant le serveur
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 MCP-Database-Connector prêt !");
}

main().catch(console.error);