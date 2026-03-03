---
prd: true
id: PRD-20260303-ocp-mcp-server
status: COMPLETE
mode: interactive
effort_level: Extended
created: 2026-03-03
updated: 2026-03-03
iteration: 1
maxIterations: 128
loopStatus: null
last_phase: VERIFY
failing_criteria: []
verification_summary: "23/23"
parent: PRD-20260303-ocp-scraper-phase1
children: []
---

# OCP Scraper MCP Server

> Expose the OCP Scraper's search, scrape, analysis, and template tools to Claude Code via Model Context Protocol (stdio transport).

## STATUS

| What | State |
|------|-------|
| Progress | 23/23 criteria passing |
| Phase | COMPLETE |
| Next action | None — MCP server ready |
| Blocked by | Nothing |

## CONTEXT

### Problem Space
The OCP Scraper has a full CLI tool with search, scrape, gaps, coverage, inspect, and template commands. To make these capabilities available to Claude Code directly (without shelling out), we need an MCP server that wraps existing modules with MCP tool registrations using stdio transport.

### Key Files
- `src/mcp/server.ts` — MCP server entry point (7 tools)
- `src/store/index.ts` — SearchIndex (reused by search, status, gaps, coverage, inspect)
- `src/store/vault.ts` — VaultStore (reused by status, inspect, scrape)
- `src/template/store.ts` — TemplateStore (reused by gaps, coverage, template_list)
- `src/cli/gaps.ts` — clusterQueries (reused for gap clustering)
- `.mcp.json` — Claude Code MCP registration (vault root)

### Constraints
- NO HTTP server or web UI
- NO new dependencies beyond @modelcontextprotocol/sdk
- NO logic duplication — reuse existing modules
- Existing CLI commands unchanged
- Stdio transport only (Claude Code native)
- Each tool returns structured JSON

### Decisions Made
- McpServer from @modelcontextprotocol/sdk with StdioServerTransport
- Zod v4 for input schemas (already installed as SDK peer dep)
- BASE_DIR resolved from import.meta.url (works in both CLI and MCP contexts)
- GITHUB_TOKEN loaded from ~/.github_token if not in env
- 7 tools map 1:1 to CLI commands (search, scrape, status, gaps, coverage, inspect, template list)
- MCP registration in vault-root .mcp.json alongside observer-control-plane

## PLAN

### Execution Strategy
Single-file build — all 7 tools in `src/mcp/server.ts`, one file wrapping existing modules.

**Group 1 (scaffold):** Install MCP SDK, create src/mcp/server.ts
**Group 2 (tools):** Register 7 tools with zod schemas and JSON returns
**Group 3 (config):** Register in .mcp.json, add `mcp` script to package.json
**Sequential:** Smoke test, full verification

### Technical Decisions
- McpServer (high-level API) over raw Server (simpler tool registration with zod)
- console.error for server startup only (stdout reserved for MCP protocol)
- Error responses use `isError: true` flag per MCP spec
- Percentage helper inlined (trivial, not worth a separate import)

## IDEAL STATE CRITERIA (Verification Criteria)

### Scaffold
- [x] ISC-Scaffold-1: MCP SDK listed as dependency in package.json file | Verify: Read: package.json
- [x] ISC-Scaffold-2: src/mcp/server.ts file exists as MCP entry point | Verify: Glob: src/mcp/server.ts
- [x] ISC-Scaffold-3: MCP server uses stdio transport not HTTP | Verify: Grep: StdioServerTransport in src/mcp/
- [x] ISC-Scaffold-4: No new dependencies beyond MCP SDK in package.json | Verify: Read: package.json diff

### Tools
- [x] ISC-Tools-1: ocp_search tool registered and returns JSON search results | Verify: CLI: MCP tools/list + tools/call
- [x] ISC-Tools-2: ocp_scrape tool registered and returns JSON scrape summary | Verify: CLI: MCP tools/list
- [x] ISC-Tools-3: ocp_status tool registered and returns JSON index stats | Verify: CLI: MCP tools/call ocp_status
- [x] ISC-Tools-4: ocp_gaps tool registered and returns JSON gap analysis | Verify: CLI: MCP tools/list
- [x] ISC-Tools-5: ocp_coverage tool registered and returns JSON coverage data | Verify: CLI: MCP tools/list
- [x] ISC-Tools-6: ocp_inspect tool registered returns full JSON-LD record | Verify: CLI: MCP tools/list
- [x] ISC-Tools-7: ocp_template_list tool registered returns approved templates JSON | Verify: CLI: MCP tools/list

### Reuse
- [x] ISC-Reuse-1: MCP tools import existing store/index module directly no duplication | Verify: Grep: import.*store/index in src/mcp/
- [x] ISC-Reuse-2: MCP tools import existing template/store module directly | Verify: Grep: import.*template/store in src/mcp/
- [x] ISC-Reuse-3: MCP tools import existing store/vault module directly | Verify: Grep: import.*store/vault in src/mcp/
- [x] ISC-Reuse-4: MCP tools reuse search enrichment module for gap clustering | Verify: Grep: import.*gaps in src/mcp/

### Config
- [x] ISC-Config-1: MCP server registered in Claude Code MCP configuration | Verify: Read: .mcp.json
- [x] ISC-Compat-1: Existing CLI entry point and commands remain completely unchanged | Verify: Read: src/cli/index.ts

### Quality
- [x] ISC-Quality-1: All seven MCP tools have zod input validation schemas | Verify: Grep: z.object in src/mcp/
- [x] ISC-Quality-2: MCP tools return error objects not throw unhandled exceptions | Verify: Grep: isError in src/mcp/

### Anti-Criteria
- [x] ISC-A-1: No HTTP server or web UI code exists in MCP module | Verify: Grep: http.createServer|express in src/mcp/
- [x] ISC-A-2: No logic duplication from existing CLI modules in MCP | Verify: Read: src/mcp/server.ts check imports
- [x] ISC-A-3: No modifications to existing src/cli/ directory files | Verify: CLI: git diff src/cli/
- [x] ISC-A-4: No console.log output in MCP tool handlers only JSON | Verify: Grep: console.log in src/mcp/

## DECISIONS

- 2026-03-03: Used McpServer high-level API (not raw Server) for simpler zod integration
- 2026-03-03: GITHUB_TOKEN loaded from ~/.github_token at server start if not in env
- 2026-03-03: BASE_DIR resolved from import.meta.url for reliable path resolution
- 2026-03-03: MCP registration in vault-root .mcp.json (not per-project)

## LOG

### Iteration 1 — 2026-03-03
- Phase reached: VERIFY → COMPLETE
- Criteria progress: 23/23 passing
- Work done: Installed MCP SDK, created src/mcp/server.ts with 7 tools, registered in .mcp.json, all smoke tests passing
- Failing: none
- Context: MCP server fully operational. 7 tools registered, all returning structured JSON. Token auto-loaded from ~/.github_token.
