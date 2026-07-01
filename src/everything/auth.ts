import { authplaneMcpAuth } from "@authplane/mcp";
import { RequestHandler } from "express";

export interface SecureMiddleware {
  bearerAuth: RequestHandler;
}

export async function initializeSecurity(): Promise<SecureMiddleware> {
  // Gracefully fall back or fail closed based on configuration
  const authConfig = await authplaneMcpAuth({
    issuer: process.env.AUTHPLANE_ISSUER || "https://auth.authplane.ai",
    resource: process.env.AUTHPLANE_RESOURCE_URI || "http://localhost:3000",
    requiredScopes: ["tools/execute"], // Enforces required scopes out of the box
    devMode: process.env.NODE_ENV !== "production"
  });

  return {
    bearerAuth: authConfig.bearerAuth
  };
}
