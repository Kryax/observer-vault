---
prd: true
id: PRD-20260303-ocp-phase3-federation
status: COMPLETE
mode: interactive
effort_level: Advanced
created: 2026-03-03
updated: 2026-03-03
iteration: 1
maxIterations: 128
loopStatus: null
last_phase: VERIFY
failing_criteria: []
verification_summary: "22/22"
parent: PRD-20260303-ocp-scraper-phase1
children: []
---

# OCP Scraper Phase 3 — Federation

> Enable vault-to-vault knowledge sharing through JSON Feed publishing, feed subscription, trust merging, and multi-forge adapter support while preserving full sovereignty.

## STATUS

| What | State |
|------|-------|
| Progress | 22/22 criteria passing |
| Phase | COMPLETE |
| Next action | None — all criteria verified |
| Blocked by | Nothing |

## CONTEXT

### Problem Space
A single vault is useful but isolated. Federation enables vaults to share Solution Records while preserving sovereignty. Each vault publishes a JSON Feed of its records; other vaults subscribe and import with discounted trust. Multi-forge support (Codeberg/Forgejo) broadens the knowledge base beyond GitHub.

### Dependencies
- **Phase 1** (COMPLETE) — record format, ForgeAdapter interface, trust vectors
- **Phase 2a** (COMPLETE) — template system for cross-vault record interoperability
- **Phase 2b** (COMPLETE) — negative space, validation events, graph enrichment
- **Phase 2c** (COMPLETE) — feedback loop, coverage dashboard, dual-speed cycle

### Key Files
- `src/forge/types.ts` — ForgeAdapter interface
- `src/forge/github.ts` — GitHub adapter (Phase 1)
- `src/forge/forgejo.ts` — Forgejo/Codeberg adapter (Phase 3)
- `src/federation/types.ts` — Federation type definitions (JSONFeed, config, subscriptions)
- `src/federation/publisher.ts` — JSON Feed generator
- `src/federation/subscriber.ts` — Feed fetcher, record importer, trust discounting
- `src/federation/config.ts` — Federation config management
- `src/ecosystems/client.ts` — Ecosyste.ms API client
- `src/ecosystems/merger.ts` — Supplemental metadata merger
- `src/cli/publish.ts` — ocp publish command
- `src/cli/subscribe.ts` — ocp subscribe command
- `src/record/assembler.ts` — Updated with forge-aware record IDs

### Constraints
- Federation is opt-in, sovereignty preserved
- Foreign records marked with provenance (which vault they came from)
- Trust from federated records starts discounted — local re-validation increases it
- Codeberg adapter uses same ForgeAdapter interface from Phase 1
- Ecosyste.ms is supplementary data source, not replacement for direct forge API
- No centralised registry or coordinator — fully peer-to-peer
- Single vault must remain fully functional without federation

### Decisions Made
- Codeberg IS Forgejo — single `ForgejoAdapter` class with `baseUrl` parameter (default: codeberg.org)
- `generateRecordId` updated with `forge` parameter for multi-forge support (defaults to 'github')
- JSON Feed 1.1 spec with `_ocp` extension for vault identity
- Trust discount 0.5 default, foreign trust capped at 0.8 via `FOREIGN_TRUST_CAP`
- Asymptotic re-validation formula: `new = old + (boost * (1 - old))`
- No ID prefixing for federation — duplicate detection via `@id` + `federation.originNode`
- Ecosyste.ms enrichment adds to `validation.evidence` and `extensions`, never touches trust vector

## PLAN

### Execution Strategy
Fan-out parallel agent build in 3 groups + sequential integration:

**Group 1 (no deps between items):** JSON Feed generator, Codeberg/Forgejo adapter, ecosyste.ms client
**Group 2 (needs Group 1):** Feed subscription/import, provenance tagging, trust discounting
**Group 3 (needs Group 2):** Trust merging policies, ocp publish and ocp subscribe commands
**Sequential:** Federation E2E test (publish -> subscribe -> verify trust), multi-forge E2E

### Technical Decisions
- JSON Feed format per JSON Feed spec (version 1.1)
- Feed published as static file in vault (git-tracked, serveable via any HTTP server)
- Trust discount factor configurable (default 0.5 — foreign trust halved)
- Provenance stored as additional JSON-LD field on federated records
- Codeberg adapter reuses Forgejo API client (Codeberg IS Forgejo)
- Ecosyste.ms data merged at metadata extraction level, not record level

## IDEAL STATE CRITERIA (Verification Criteria)

### Publishing
- [x] ISC-Pub-1: ocp publish command generates valid JSON Feed from vault records | Verify: CLI: run publish and validate JSON Feed format
- [x] ISC-Pub-2: Published feed includes all approved records with full metadata | Verify: Read: feed output contains record count matching index
- [x] ISC-Pub-3: Feed file is static and git-trackable in vault directory | Verify: Glob: feed.json in vault root or designated location

### Subscription
- [x] ISC-Sub-1: ocp subscribe command accepts feed URL and imports records | Verify: CLI: subscribe to local test feed
- [x] ISC-Sub-2: Imported records tagged with source vault provenance metadata | Verify: Read: provenance field on imported records
- [x] ISC-Sub-3: Duplicate records from same source vault are updated not duplicated | Verify: CLI: re-subscribe updates existing records

### Trust Merging
- [x] ISC-Trust-1: Foreign record trust vectors discounted by configurable factor | Verify: Read: discount factor applied during import
- [x] ISC-Trust-2: Default trust discount factor is zero point five for imports | Verify: Read: default config value is 0.5
- [x] ISC-Trust-3: Local re-validation of foreign records increases trust toward local levels | Verify: Read: validation events update foreign record trust
- [x] ISC-Trust-4: Trust merging policy is configurable per subscription source | Verify: Read: per-source config in subscription settings

### Forge Adapters
- [x] ISC-Forge-1: Codeberg adapter implements ForgeAdapter interface from Phase 1 | Verify: Read: forgejo.ts implements ForgeAdapter
- [x] ISC-Forge-2: Codeberg adapter uses Forgejo API compatible with Codeberg instance | Verify: Read: API calls target Forgejo endpoints
- [x] ISC-Forge-3: ocp scrape command accepts --source codeberg flag successfully | Verify: CLI: scrape --source codeberg --topic test
- [x] ISC-Forge-4: Forgejo adapter shares implementation with Codeberg via base class | Verify: Read: single parameterized ForgejoAdapter class

### Ecosyste.ms
- [x] ISC-Eco-1: Ecosyste.ms client fetches bulk package metadata by ecosystem | Verify: Read: ecosystems API client implementation
- [x] ISC-Eco-2: Ecosyste.ms data supplements not replaces direct forge API metadata | Verify: Read: merge logic preserves forge-sourced fields

### Sovereignty
- [x] ISC-Sov-1: Single vault operates fully without any federation configuration | Verify: CLI: all Phase 1 commands work without federation config
- [x] ISC-Sov-2: Federation is opt-in requiring explicit subscribe command to activate | Verify: Read: no automatic federation on install

### Anti-Criteria
- [x] ISC-A-WebUI-1: No web server or browser-facing UI code exists anywhere | Verify: Grep: no express/fastify/http.createServer imports
- [x] ISC-A-Central-1: No centralised registry or coordinator service exists in code | Verify: Grep: no registry/coordinator endpoints
- [x] ISC-A-Mandatory-1: No code path forces federation on single-vault operators | Verify: Read: federation modules are optional imports
- [x] ISC-A-TrustInflation-1: No path allows foreign trust to exceed local trust levels | Verify: Read: trust cap logic (FOREIGN_TRUST_CAP = 0.8) in merging policy

## DECISIONS

- 2026-03-03: ForgejoAdapter as single parameterized class (not separate Codeberg + Forgejo classes)
- 2026-03-03: generateRecordId updated with forge parameter, defaults to 'github' for backward compat
- 2026-03-03: Federation duplicate detection by @id + originNode (no ID prefixing)
- 2026-03-03: Foreign trust cap at 0.8 (FOREIGN_TRUST_CAP constant in subscriber.ts)
- 2026-03-03: Ecosyste.ms enrichment targets validation.evidence and extensions only

## LOG

### Iteration 1 — 2026-03-03
- Phase reached: VERIFY
- Criteria progress: 22/22
- Work done: Full Phase 3 build via fan-out agents (Group 1: 3 parallel, Group 2: 1 sequential)
- Failing: none
- Files created: 11 new files (federation/, ecosystems/, forge/forgejo.ts, CLI commands)
- Files modified: 4 (assembler.ts, scrape.ts, forge/index.ts, cli/index.ts)
- Tests: 54 passing (pre-existing) + 16 federation tests + 38 ecosystems tests = 54+ total
- Type check: clean (zero errors)
- E2E verified: publish -> subscribe -> provenance check -> trust discount confirmed (0.87 -> 0.435 = 0.5x)
