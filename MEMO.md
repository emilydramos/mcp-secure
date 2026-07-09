###  Why Authentication is Not Present

These MCP servers are not designed to be production-ready solutions and are intended as reference implementations to demonstrate MCP features and SDK usage. 

The reference servers ship with stdio transport — they communicate over stdin/stdout as subprocesses of the MCP host (Claude Desktop, Cursor, etc.). No network socket is ever opened, so there's no authentication surface. The OS process model is the trust boundary.

As the developers state, this server is also able to access local/internal IP addresses and can pose a security risk. This includes SSRF (Server-Side-Request-Foregery), where an attacker tricks a server into making unauthorized requests on their behalf. 

### Running the Server Locally

Initial approach: When I attempted to build and execute the server locally using standard npm install and npm run build workflows within the cloned repository, dependency conflicts and workspace compilation errors emerged in other sub-projects across the monorepo (e.g., missing dependencies like chalk in the adjacent sequentialthinking package). This locked the global building phase and initially blocked standard node or npm run execution states.

Using NPX: After using npx, I was able to get the server to run. Npx (Node Package Executer) downloads and runs a clean, pre-compiled, and published version of the package directly from the remote npm registry into a temporary cache. By using npx, it completely bypassed the local file system structure, local code alterations, and broken neighboring workspace configurations.

### Commands to Test Integration
Navigate to the directory: `cd src/everything`

Fetch dependencies (installs official Authplane SDKs): `npm install`

Compile the environment safely (isolates compilation to this folder): `npx tsc`

Spin up the server: `npm run start:streamableHttp`

Test validation with cURL (Should yield authorization rejection from the Authplane SDK middleware):  
curl -X POST http://localhost:3001/mcp -d "{}" -H "Content-Type: application/json"

### Product Comparison Table: Original Server vs. Secured Version

### Product Comparison Table: Original Server vs. Secured Version

| Criteria | Original `everything` Server | Secured Authplane Version |
| :--- | :--- | :--- |
| **Authentication Model** | None. Relies purely on local OS process boundary (`STDIO`) or completely open network sockets. | Token-based (OAuth 2.1 / Bearer JWT) with automated scope verification. |
| **Developer Effort** | Zero out-of-the-box overhead. | Minimal. Seamless drop-in Express middleware wrapping standard handlers. |
| **Security Posture** | Vulnerable to arbitrary tool invocation or data leakage if exposed over an open network port. | Zero-Trust. Requests missing a valid token or appropriate scope are rejected natively by the official SDK middleware. |
| **Deployment Complexity** | Extremely trivial, localized to a single machine. | Medium. Installs production dependencies via `@authplane/mcp` and hooks directly into the Express application lifecycle. |
| **Documentation Quality** | Focuses entirely on showcasing MCP primitives, completely omitting production security guidelines. | High. Clear SDK references for middleware instantiation and scope requirement mapping. |
| **Auditability or Observability** | Missing. Client actions are logged anonymously with no identity attribution. | High. Requests map cryptographically to individual client IDs, tokens, and specific authorization contexts. |
| **Known Limitations** | Cannot be safely exposed to webhooks or cross-machine agent execution. | Network latency overhead added per token crypt-validation trip. |


### Repository Selection
The repository selected was the modelcontextprotocol/servers repository. It provides a collection of reference implementations for MCP servers, so it is a good choice for developers looking to implement more robust authentication. 

### Current Authentication & Security Posture
By default, the Model Context Protocol presumes isolation over standard input/output (`stdio`) child process boundaries. When shifted onto open TCP ports via HTTP or SSE (Server-Sent Events), the implementation natively exposes all features anonymously with zero access validation tokens or origin checks, permitting arbitrary command invocation.

### Authplane Integration
The secure server configuration was successfully achieved by integrating the official @authplane/mcp SDK package directly into the Express pipeline within src/everything/streamableHttp.ts. By invoking the authentic authplaneMcpAuth middleware factory, the server maps an automated token-verification gateway over its network transport layer, configured with an active target resource uri, a broad scope target (mcp:all), and local development mode enabled to bypass remote TLS requirements during validation tests. This official middleware sits upstream of all core execution routes, intercepting incoming HTTP and SSE payloads globally to cryptographically validate the client's Authorization: Bearer <token> header, immediately dropping unauthenticated requests with standard OAuth 2.1 protocol errors before they can interface with the underlying Model Context Protocol engine.

### Files Modified/Added
The files modified were package.json, index.ts, and streamableHttp.ts to implement the official SDK hooks.

### Developer Experience 
What was easy: The drop-in Express integration hook is highly intuitive. It keeps code readability intact without modifying complex nested JSON-RPC parsing internals.

What was difficult: Local developer debugging can loop into state inconsistencies if the inspector frontend caches old configurations or requires a local test authorization server wrapper.  

Production Adaptations Needed: Before scaling to live endpoints, a stable token caching scheme must be defined, local mock authentication configs switched off, and proper CORS rules explicitly mapped.
