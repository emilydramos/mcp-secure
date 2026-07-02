import {
  StreamableHTTPServerTransport,
  EventStore,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import { createServer } from "../server/index.js";
import { randomUUID } from "node:crypto";
import cors from "cors";

// (NEW) Import the Authplane security initializer
import { initializeSecurity } from "./auth.js";

// Simple in-memory event store for SSE resumability
class InMemoryEventStore implements EventStore {
  private events: Map<string, { streamId: string; message: unknown }> =
    new Map();

  async storeEvent(streamId: string, message: unknown): Promise<string> {
    const eventId = randomUUID();
    this.events.set(eventId, { streamId, message });
    return eventId;
  }

  async replayEventsAfter(
    lastEventId: string,
    { send }: { send: (eventId: string, message: unknown) => Promise<void> }
  ): Promise<string> {
    const entries = Array.from(this.events.entries());
    const startIndex = entries.findIndex(([id]) => id === lastEventId);
    if (startIndex === -1) return lastEventId;

    let lastId: string = lastEventId;
    for (let i = startIndex + 1; i < entries.length; i++) {
      const [eventId, { message }] = entries[i];
      await send(eventId, message);
      lastId = eventId;
    }
    return lastId;
  }
}

// Map sessionId to server transport for each client
const transports: Map<string, StreamableHTTPServerTransport> = new Map<
  string,
  StreamableHTTPServerTransport
>();

// (NEW) Server logic is wrapped in main() to allow asynchronous auth setup
async function main() {
  console.log("Starting Streamable HTTP server with Authplane validation...");

  const app = express();
  
  // Parse incoming JSON bodies safely
  app.use(express.json());

  app.use(
    cors({
      origin: "*", 
      methods: "GET,POST,DELETE",
      preflightContinue: false,
      optionsSuccessStatus: 204,
      exposedHeaders: ["mcp-session-id", "last-event-id", "mcp-protocol-version"],
    })
  );

  // (NEW) Initialize and apply Authplane security layers globally to downstream routes
  const security = await initializeSecurity();
  app.use(security.bearerAuth);

  // Handle POST requests for client messages
  app.post("/mcp", async (req: Request, res: Response) => {
    console.log("Received MCP POST request");
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId)!;
      } else if (!sessionId) {
        const { server, cleanup } = createServer();
        const eventStore = new InMemoryEventStore();
        
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore,
          onsessioninitialized: (sessionId: string) => {
            console.log(`Session initialized with ID: ${sessionId}`);
            transports.set(sessionId, transport);
          },
        });

        server.server.onclose = async () => {
          const sid = transport.sessionId;
          if (sid && transports.has(sid)) {
            console.log(`Transport closed for session ${sid}, removing from transports map`);
            transports.delete(sid);
            cleanup(sid);
          }
        };

        await server.connect(transport);
        await transport.handleRequest(req, res);
        return;
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: No valid session ID provided" },
          id: req?.body?.id,
        });
        return;
      }

      await transport.handleRequest(req, res);
    } catch (error) {
      console.log("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: req?.body?.id,
        });
        return;
      }
    }
  });

  // Handle GET requests for SSE streams
  app.get("/mcp", async (req: Request, res: Response) => {
    console.log("Received MCP GET request");
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: req?.body?.id,
      });
      return;
    }

    const lastEventId = req.headers["last-event-id"] as string | undefined;
    if (lastEventId) {
      console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
      console.log(`Establishing new SSE stream for session ${sessionId}`);
    }

    const transport = transports.get(sessionId);
    await transport!.handleRequest(req, res);
  });

  // Handle DELETE requests for session termination
  app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: req?.body?.id,
      });
      return;
    }

    console.log(`Received session termination request for session ${sessionId}`);

    try {
      const transport = transports.get(sessionId);
      await transport!.handleRequest(req, res);
    } catch (error) {
      console.log("Error handling session termination:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Error handling session termination" },
          id: req?.body?.id,
        });
        return;
      }
    }
  });

  // Start the server
  const PORT = process.env.PORT || 3001;
  const server = app.listen(PORT, () => {
    console.error(`Secure MCP Streamable HTTP Server listening on port ${PORT}`);
  });

  server.on("error", (err: unknown) => {
    const code = typeof err === "object" && err !== null && "code" in err ? (err as { code?: unknown }).code : undefined;
    if (code === "EADDRINUSE") {
      console.error(`Failed to start: Port ${PORT} is already in use.`);
    } else {
      console.error("HTTP server encountered an error while starting:", err);
    }
    process.exit(1);
  });
}

// Execute the main script lifecycle
main().catch((err) => {
  console.error("Initialization failure:", err);
  process.exit(1);
});

// Handle server shutdown cleanups
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  for (const sessionId in transports) {
    try {
      await transports.get(sessionId)!.close();
      transports.delete(sessionId);
    } catch (error) {
      console.log(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  process.exit(0);
});
