###  Why Authentication is Not Present

These MCP servers are not designed to be production-ready solutions and are intended as reference implementations to demonstrate MCP features and SDK usage. 

The reference servers ship with stdio transport — they communicate over stdin/stdout as subprocesses of the MCP host (Claude Desktop, Cursor, etc.). No network socket is ever opened, so there's no authentication surface. The OS process model is the trust boundary.

As the developers state, this server is also able to access local/internal IP addresses and can pose a security risk. This includes SSRF (Server-Side-Request-Foregery), where an attacker tricks a server into making unauthorized requests on their behalf. 

### Commands to Test Integration
Navigate to the directory: `cd src/everything`

Fetch dependencies: `npm install`

Compile the environment: `npm run build`

Spin up the server: `npm run start:streamableHttp`

Test validation with cURL (Should yield authorization rejection):  curl -X POST http://localhost:3001/mcp -d "{}" -H "Content-Type: application/json"

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


### Repository Selection
The repository selected was the modelcontextprotocol/servers repository. It provides a collection of reference implementations for MCP servers, so it is a good choice for developers looking to implement more robust authentication. 

### Current Authentication & Security Posture
By default, the Model Context Protocol presumes isolation over standard input/output (`stdio`) child process boundaries. When shifted onto open TCP ports via HTTP or SSE (Server-Sent Events), the implementation natively exposes all features anonymously with zero access validation tokens or origin checks, permitting arbitrary command invocation.

### Explanation of Integration
The architecture decouples configuration parameters via `src/everything/auth.ts`. An initialization routine creates the Express-integrated middleware `bearerAuth` via `@authplane/mcp`. 

The middleware interceptor sits strictly upstream of the `/sse` and `/mcp` endpoints. Any incoming client payload lacking an authorized JWT header matching the required authorization scopes (`tools/execute`) is blocked directly at the gateway with an immediate error response.

### Files Modified/Added
The files changed were the package.json and the index.ts file. The auth.ts file was added. 

### Developer Experience 
What was easy: The drop-in Express integration hook is highly intuitive. It keeps code readability intact without modifying complex nested JSON-RPC parsing internals.

What was Difficult: Local developer debugging can loop into state inconsistencies if the inspector frontend caches old configurations or requires a local test authorization server wrapper.  Production Adaptations Needed: Before scaling to live endpoints, a stable token caching scheme must be defined, local mock authentication configs switched off, and proper CORS rules explicitly mapped.
