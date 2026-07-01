###  Why authentication is not present

These MCP servers are not designed to be production-ready solutions and are intended as reference implementations to demonstrate MCP features and SDK usage. 

The reference servers ship with stdio transport — they communicate over stdin/stdout as subprocesses of the MCP host (Claude Desktop, Cursor, etc.). No network socket is ever opened, so there's no authentication surface. The OS process model is the trust boundary.

As the developers state, this server is also able to access local/internal IP addresses and can pose a security risk. This includes SSRF (Server-Side-Request-Foregery), where an attacker tricks a server into making unauthorized requests on their behalf. 

### Commands to Test Integration
npm install
npm run build

### Product Comparison Table: Original Server vs. Secured Version

| Criteria | Original `everything` Server | Secured Authplane Version |
| :--- | :--- | :--- |
| **Authentication Model** | None. Relies purely on local OS process boundary (`STDIO`) or completely open network sockets. | Token-based (OAuth 2.1 / Bearer JWT) with automated scope verification. |
| **Developer Effort** | Zero out-of-the-box overhead. | Minimal. Seamless drop-in Express middleware wrapping standard handlers. |
| **Security Posture** | Vulnerable to arbitrary tool invocation or data leakage if exposed over an open network port. | Zero-Trust. Requests missing a valid token or appropriate scope are rejected with an explicit `InsufficientScopeError`. |
| **Deployment Complexity** | Extremely trivial, localized to a single machine. | Medium. Requires pointing to an active Authplane authorization server (or self-hosted `authserver` container). |
| **Documentation Quality** | Focuses entirely on showcasing MCP primitives, completely omitting production security guidelines. | High. Clear SDK references for middleware instantiation and scope requirement mapping. |
| **Auditability or Observability** | Missing. Client actions are logged anonymously with no identity attribution. | High. Requests map cryptographically to individual client IDs, tokens, and specific authorization contexts. |
| **Known Limitations** | Cannot be safely exposed to webhooks or cross-machine agent execution. | Network latency overhead added per token crypt-validation trip. |
