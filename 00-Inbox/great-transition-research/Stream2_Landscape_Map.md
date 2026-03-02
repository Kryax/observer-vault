# Stream 2: Landscape Map

**Date:** 2 March 2026
**Stream:** 2 of 4 — Landscape Mapping
**Status:** Complete
**Author:** Atlas/PAI subagent (Stream 2)

---

## Executive Summary

The landscape across all four domains is characterised by a striking pattern: **massive corporate investment in the infrastructure layer, with genuine whitespace in the governance, sovereignty, and state-management layers**. The MCP ecosystem has become the gravitational centre for AI agent tooling, now under Linux Foundation governance via the Agentic AI Foundation (AAIF). Enterprise governance platforms are funded but immature. Ideal state management as a concept barely exists as a product category. Sovereignty tooling is growing at the national/enterprise level but remains almost entirely absent at the individual/small-team level.

**Key finding across all domains:** There is no project or product that combines governance-aware orchestration, sovereignty-preserving architecture, federated solution discovery, and ideal state management into a coherent system. These are treated as separate problems by separate companies. Adam's Observer ecosystem is architecturally positioned at the intersection of all four — which is either a massive opportunity or a sign that the market hasn't validated this intersection as a real category yet.

**Surprising findings:**
1. Nobody is using Cynefin or any formal complexity classification framework in AI agent orchestration — this is pure whitespace
2. The MCP Registry is explicitly designed as a federated protocol, not a centralised platform — closer to Adam's Observer Commons vision than expected
3. The "ideal state management" concept has essentially zero product-market presence despite Miessler's articulation of it — the gap is enormous
4. Sovereignty tooling at the individual level is almost entirely limited to "run Ollama locally" — no governance, no structured oversight, no federation

---

## Domain 2A: Service Directories / Solution Indexes

### Current Actors

#### Tier 1: Protocol-Level Infrastructure

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **MCP Registry (Official)** | Open protocol | The official Model Context Protocol Registry, launched in preview September 2025. Federated discovery layer — designed as a "primary source of truth" that sub-registries can mirror and extend. Open schema and API published on GitHub. | [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/) |
| **Agentic AI Foundation (AAIF)** | Linux Foundation directed fund | Governs MCP, Goose, and AGENTS.md. Co-founded by Anthropic, Block, OpenAI. Platinum members include AWS, Google, Microsoft, Bloomberg, Cloudflare. | [aaif.io](https://aaif.io/) |
| **Agent2Agent (A2A) Protocol** | Open protocol (Google-originated) | Agent-to-agent communication standard enabling capability discovery via "Agent Cards" (JSON format), task management, and context sharing. Now under Linux Foundation governance. 100+ technology company supporters. | [github.com/a2aproject/A2A](https://github.com/a2aproject/A2A) |

#### Tier 2: Registry Platforms / Marketplaces

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **Smithery** | MCP server registry | Registry for discovering MCP servers. Acts as a sub-registry of the official MCP Registry. Provides search and categorisation. | [smithery.ai](https://smithery.ai/) |
| **PulseMCP** | Community hub / newsletter | Community discovery hub for MCP servers, clients, and news. Provides usage metrics and global leaderboard ranking using an algorithm based on public data, social signals, and download counts. | [pulsemcp.com](https://www.pulsemcp.com/) |
| **Kong MCP Registry** | Enterprise (proprietary) | Enterprise directory within Kong Konnect Catalog. Registers, discovers, and governs MCP servers. Links MCP servers to underlying API dependencies, ownership, blast radius, and policies. | [prnewswire.com](https://www.prnewswire.com/news-releases/kong-introduces-mcp-registry-in-kong-konnect-to-power-ai-connectivity-for-agent-discovery-and-governance-302676451.html) |

#### Tier 3: Gateway / Federation Infrastructure

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **ContextForge (IBM)** | Open source gateway | AI Gateway, registry, and proxy for MCP, A2A, and REST/gRPC APIs. Supports multi-gateway federation with auto-discovery via mDNS. 40+ plugins. v1.0.0-BETA-1 released December 2025. | [github.com/IBM/mcp-context-forge](https://github.com/IBM/mcp-context-forge) |
| **MCP Gateway & Registry (Agentic Community)** | Open source | Enterprise-ready gateway with OAuth authentication, dynamic tool discovery, Keycloak/Entra integration. | [github.com/agentic-community/mcp-gateway-registry](https://github.com/agentic-community/mcp-gateway-registry) |
| **Microsoft MCP Gateway** | Open source | Reference implementation for Kubernetes. Traffic routing, policy enforcement, Azure observability integration. | Referenced in [Medium: MCP Gateways in 2026](https://bytebridge.medium.com/mcp-gateways-in-2026-top-10-tools-for-ai-agents-and-workflows-d98f54c3577a) |

#### Tier 4: Decentralised / Blockchain Approaches

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **ERC-8004** | Ethereum standard | Decentralised identity, reputation, and verification for AI agents. Three registries: Identity (capabilities), Reputation (performance feedback), Validation (cryptographic proof). Launched on Ethereum mainnet January 2026. 20,000+ agents deployed in first two weeks. | [4sysops.com](https://4sysops.com/archives/what-is-erc-8004-ai-agents-build-trust-using-blockchain-technology/) |
| **Fetch.ai / ASI Alliance** | Decentralised agent platform | Agentverse marketplace for deploying and monetising on-chain autonomous agents. Merger of Fetch.ai, SingularityNET, Ocean Protocol, and CUDOS. | [fetch.ai](https://fetch.ai/) |
| **Virtuals Protocol** | Agent launchpad | Platform for building, owning, and monetising tokenised AI agents. GAME framework and Agent Commerce Protocol. | Referenced in blockchain search results |

### Maturity Assessment

**Overall maturity: Early-to-mid stage (infrastructure solidifying, quality/reputation layers barely started)**

The *protocol* layer is surprisingly mature — MCP has achieved de facto standard status with Linux Foundation governance, major corporate backing, and a functioning registry. The *discovery* layer exists but is basic — Smithery and PulseMCP provide catalogues but not sophisticated quality assessment. The *reputation/rating* layer is essentially non-existent in the traditional tech stack. PulseMCP's usage-based ranking is the closest thing, but it measures popularity, not quality or reliability.

The blockchain/crypto ecosystem has moved faster on reputation (ERC-8004's three-registry approach is architecturally sophisticated), but suffers from the typical crypto adoption gap — technically interesting, practically limited to the crypto-native audience.

**Confidence level: HIGH for protocol/registry status; MEDIUM for blockchain adoption claims; LOW for quality/reputation maturity.**

### Gap Analysis

1. **No quality/reliability rating system.** MCP registries tell you *what exists* but not *how well it works*. There is no equivalent of npm download counts + quality scores, no automated testing of MCP server reliability, no structured user feedback mechanism. PulseMCP's leaderboard is the closest, but it measures visibility, not quality.

2. **No sovereignty-preserving discovery.** All current registries are centralised (even if open-source). The MCP Registry is *designed* for federation (sub-registries can mirror it), but no one has built a truly decentralised, peer-to-peer discovery layer. ContextForge's mDNS auto-discovery is the most interesting technical precursor but it operates at the infrastructure level, not the user/community level.

3. **No semantic matching.** Current registries use keyword/category search. No one is doing intent-based matching — "I need a tool that can do X" resolved against capability descriptions. A2A's Agent Cards provide structured capability metadata, but there is no matching engine.

4. **No cross-protocol federation.** MCP and A2A are complementary but separate. No system bridges them into a unified discovery layer. ContextForge is the closest, supporting both protocols behind a single endpoint.

5. **No community-curated quality signals.** The model of "verified by community testing" that drives Linux distribution package quality does not exist for AI agent tooling.

### Observer Ecosystem Fit

**Observer Commons as a federated solution index protocol maps directly to Gap #2 and Gap #5.**

The MCP Registry is architecturally designed for exactly what Observer Commons envisions — federated discovery where multiple registries share a common protocol. But *nobody has built the community governance layer on top*. The technical infrastructure exists (MCP Registry + federation support); the *social/governance infrastructure* does not.

Specifically:
- **Observer Commons' solution index concept** could sit as a sub-registry of the MCP Registry, adding structured quality signals, community verification, and sovereignty-preserving metadata
- **The Observer Council's structured decision-making** (Clarifier, Architect, Sentry, Builder) maps to what a governance layer for a quality-rated service directory would need — classification, verification, risk assessment
- **OIL's governance gates** could enforce policies on which services are included, how they're rated, and what sovereignty guarantees they provide

**Risk:** The MCP ecosystem is moving fast and has massive corporate backing. A small-team effort would need to build *on top of* MCP, not compete with it.

### Competitive Dynamics

**Momentum holders:**
- MCP (dominant protocol, Linux Foundation governance)
- Kong (enterprise customers, existing API management market position)
- IBM ContextForge (open source, federation capabilities)
- Google A2A (corporate backing, 100+ partners)

**Community-driven:**
- MCP Registry itself (community-built with corporate support)
- PulseMCP (community hub/newsletter)
- Smithery (independent registry)

**Funded but early:**
- ERC-8004 (Ethereum Foundation + major crypto players)
- Fetch.ai/ASI Alliance (well-funded but crypto-captured)

**Notable absence:** No independent, sovereignty-focused, community-governed service directory exists. Every current player is either corporate-backed or crypto-token-incentivised.

---

## Domain 2B: Governance-as-a-Service / AI Orchestration Governance

### Current Actors

#### Enterprise Governance Platforms

| Actor | Type | Funding/Scale | Description | URL |
|-------|------|---------------|-------------|-----|
| **Credo AI** | Enterprise SaaS | VC-funded, Gartner-recognised | End-to-end AI governance across lifecycle. Risk dashboards, compliance tracking, regulatory alignment. Strong in financial services, government, healthcare. | [credo.ai](https://www.credo.ai/) |
| **IBM watsonx.governance** | Enterprise SaaS | IBM corporate | Model oversight, compliance, agentic AI monitoring. v2.3.x (Dec 2025) added agent inventory management, behaviour monitoring, hallucination detection. Limited cross-platform integration. | [ibm.com](https://www.ibm.com/think/topics/ai-governance) |
| **Holistic AI** | Enterprise SaaS | VC-funded | AI governance with discovery, inventory, audits, regulatory reporting. RAG (Red/Amber/Green) risk dashboard. | [holisticai.com](https://www.holisticai.com/) |
| **Airia** | Enterprise SaaS | $100M funded (Sept 2025) | AI orchestration + security + governance unified platform. 300+ enterprise customers in 12 months. Co-founder previously built AirWatch ($1.54B exit to VMware). Governance module launched January 2026. | [airia.com](https://airia.com/) |
| **OneTrust** | Enterprise GRC | VC-funded, large scale | Data & AI governance. Model documentation, review processes. Broader than AI-specific. | [onetrust.com](https://www.onetrust.com/) |
| **Kore.ai** | Enterprise AI platform | VC-funded | Comprehensive AI governance dashboard with agent decision tracing, guardrails, RBAC, audit logs. Part of broader agentic AI platform. | [kore.ai](https://www.kore.ai/) |

#### Open Source Governance / Guardrails

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **Superagent** | Open source | Framework for building/running/controlling AI agents with safety built in. Safety Agent acts as policy enforcement layer evaluating actions before execution. | [github.com/superagent-ai/superagent](https://github.com/superagent-ai/superagent) |
| **OpenGuardrails** | Open source | Runtime security framework for AI agents. Prompt injection detection, content safety (19 risk categories), enterprise agent inventory. 14B model quantised to 3.3B. | [openguardrails.com](https://openguardrails.com/) |
| **NVIDIA NeMo Guardrails** | Open source (NVIDIA) | Programmable guardrails using Colang DSL. Topic control, PII detection, RAG grounding, jailbreak prevention. Strong for conversational AI. | [github.com/NVIDIA-NeMo/Guardrails](https://github.com/NVIDIA-NeMo/Guardrails) |
| **Meta LlamaFirewall** | Open source (Meta) | Security-focused guardrails for AI agents. ML-based classifiers for prompt injection, jailbreak, agent misalignment detection. Released May 2025. | [ai.meta.com](https://ai.meta.com/research/publications/llamafirewall-an-open-source-guardrail-system-for-building-secure-ai-agents/) |
| **MAESTRO Framework** | Framework/reference | Defence-oriented framework for identifying, modelling, and mitigating threats in agentic AI systems. Addresses autonomy-driven risks. | Referenced in NIST search results |

#### Standards / Regulatory Frameworks

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **Singapore MGF for Agentic AI** | Government framework | World's first governance framework specifically for AI agents (January 2026). Four dimensions: risk bounding, human accountability, technical controls, end-user responsibility. | [imda.gov.sg](https://www.imda.gov.sg/resources/press-releases-factsheets-and-speeches/press-releases/2026/new-model-ai-governance-framework-for-agentic-ai) |
| **EU AI Act** | Regulation | Comprehensive AI regulation. High-risk system rules effective August 2026. Fines up to EUR 35M or 7% global turnover. | Referenced in governance search results |
| **NIST AI Agent Standards Initiative** | US government | Launched January-February 2026. RFI on securing AI agent systems. Anticipated focus: security controls, risk management for agents. | [pillsburylaw.com](https://www.pillsburylaw.com/en/news-and-insights/nist-ai-agent-standards.html) |
| **OWASP Top 10 for Agentic Applications** | Industry standard | Released December 2025. Identifies tool misuse, prompt injection, data leakage as primary threats. | Referenced in NIST search results |

### Maturity Assessment

**Overall maturity: Nascent-to-early (high demand, fragmented supply, no clear winner)**

The market is at a genuine inflection point. Gartner projects AI governance spending reaching **$492 million in 2026, surpassing $1 billion by 2030**. Organisations with deployed AI governance platforms are **3.4x more likely to achieve high effectiveness** (Gartner Q2 2025 survey). Yet **only 6% of organisations have advanced AI security strategies** despite 40% of enterprise applications expected to embed autonomous agents by end of 2026.

The current market splits into two tiers:
- **Enterprise platforms** (Credo AI, IBM watsonx, Airia): full-featured but expensive, proprietary, cloud-captured
- **Open source guardrails** (Superagent, OpenGuardrails, NeMo, LlamaFirewall): safety-focused but not governance-complete — they block bad things, they don't provide structured decision-making

**What's missing is the middle layer: structured governance *logic* — not just guardrails, but decision frameworks, complexity classification, human-oversight triggers, and audit trails.**

**Confidence level: HIGH for market size projections (Gartner, Deloitte); HIGH for platform descriptions; MEDIUM for adoption claims.**

### Gap Analysis

1. **Nobody is using formal complexity classification.** Despite Cynefin being well-known in management consulting, no AI governance product classifies agent tasks by complexity domain (clear/complicated/complex/chaotic) to determine appropriate governance levels. Every system applies the same governance regardless of task complexity. This is a major conceptual gap — a simple API call and a complex multi-agent negotiation should not require the same oversight structure.

2. **No structured decision-making frameworks.** Current governance is essentially "guardrails + audit logs." Nobody provides a structured *decision process* — pre-mortem analysis, multi-perspective evaluation, sovereignty checks, escalation logic. The Observer Council's pattern of roles (Clarifier, Architect, Sentry, Builder) with structured gates is architecturally more sophisticated than anything on the market.

3. **No open-source governance *framework* (as distinct from guardrails).** Superagent and OpenGuardrails are safety tools, not governance frameworks. They prevent bad outcomes but don't structure good decision-making. The gap between "block prompt injections" and "structured human-AI governance" is enormous.

4. **No human-on-the-loop architecture.** Enterprise platforms are still operating in a human-in-the-loop paradigm (approve/reject each action) or fully autonomous mode. The emerging concept of "human-on-the-loop" (humans monitor dashboards and intervene on exceptions) lacks tooling support. **[UNCERTAINTY: This gap may be closing faster than research suggests — enterprise platforms iterate quickly.]**

5. **Enterprise platforms are siloed.** IBM watsonx.governance has "limited capabilities in linking multiple objects or models together" and "integrating with tools outside IBM is either very challenging or currently not possible." This is the industry pattern — governance tied to a specific platform, not portable across environments.

### Observer Ecosystem Fit

**The Observer Council pattern fills Gaps #1, #2, and #3 simultaneously.**

- **Cynefin gates** = Gap #1 (complexity classification). No competitor offers this.
- **Structured roles** (Clarifier, Architect, Sentry, Builder) = Gap #2 (decision frameworks). Current products audit outcomes; Observer Council structures *how decisions are made*.
- **OIL as a governance layer** = Gap #3 (open-source governance framework). OIL provides the governance execution layer that sits between the guardrails (block bad things) and the agent (do things).
- **Pre-Mortem analysis** embedded in the governance process = unique capability. No governance platform includes structured pre-failure analysis.

**The strategic question:** Should this be offered as a standalone governance product, an open protocol that other platforms adopt, or a consulting methodology? The market size ($492M in 2026) suggests real commercial potential, but enterprise buyers prefer platforms from funded companies with sales teams.

### Competitive Dynamics

**Well-funded and accelerating:**
- Airia ($100M, 300 customers in 12 months) — fast-moving, unified platform
- Credo AI (VC-funded, Gartner-recognised) — regulatory compliance focus
- IBM watsonx (corporate backing, but integration limitations)

**Community/open-source:**
- Superagent, OpenGuardrails — growing but safety-focused, not governance-complete
- NVIDIA NeMo Guardrails — strong for conversational AI, limited for agentic workflows
- Meta LlamaFirewall — narrow scope (security only)

**Standards bodies:**
- NIST, OWASP, Singapore IMDA — setting the frameworks that governance tools must implement
- EU AI Act — creating compliance demand that drives market growth

**Notable absence:** No open-source, sovereignty-preserving, complexity-aware governance framework exists. The market is entirely split between expensive enterprise SaaS and narrow safety tools.

---

## Domain 2C: Ideal State Management / State Orchestration

### Current Actors

#### Closest Existing Category: OKR / Strategy Execution Platforms

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **Rhythms** | AI-native OKR platform | "First AI-native business operating system." Automates OKR creation, check-ins, risk monitoring. Founded by Ally.io team (acquired by Microsoft for Viva Goals). $26M funding from Accel, Greenoaks, Madrona. | [rhythms.ai](https://www.rhythms.ai/) |
| **Workpath** | Enterprise strategy execution | AI-powered platform integrating OKRs, KPIs, Business Reviews. Acquired Quantive (formerly Gtmhub) in May 2025. Enterprise focus. | [workpath.com](https://www.workpath.com/) |
| **WorkBoard** | Enterprise strategy execution | Acquired Quantive, combining 150+ data integrations. Enterprise OKR focus. | Referenced in OKR search results |
| **Profit.co** | OKR software | Strategy execution platform with OKR tracking, task management, employee engagement. | [profit.co](https://www.profit.co/) |

#### AI PRD / Requirements Generation

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **ChatPRD** | AI PRD generator | AI-powered PRD creation with CPO-level strategic gap analysis. Reviews documents for competitive, technical, and UX gaps. | [chatprd.ai](https://www.chatprd.ai/) |
| **Figma AI PRD Generator** | Design-integrated | PRD generation within Figma Make. Design-to-requirements workflow. | [figma.com](https://www.figma.com/solutions/ai-prd-generator/) |

#### Continuous Improvement Platforms

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **Impruver** | Lean management | AI, cloud, IoT for continuous improvement. Centralises CI activity, automates reporting. Industrial/manufacturing focus. | [impruver.com](https://impruver.com/) |
| **ITIL/ITSM AI tools** | IT service management | AI-driven trend analysis across tickets, resolution times, escalation rates. Surfaces performance gaps. | Referenced in ITSM search results |

#### The Conceptual Framework: Miessler's "The Algorithm"

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **Daniel Miessler's PAI / The Algorithm** | Open source framework | General problem-solving algorithm using verifiable Ideal State Criteria. Current State -> Ideal State via continuous hill-climbing. Claude Code native. v3.0 released. Active development. | [github.com/danielmiessler/TheAlgorithm](https://github.com/danielmiessler/TheAlgorithm) |

### Maturity Assessment

**Overall maturity: Pre-category (the concept exists but the product category does not)**

This is the most striking finding across all four domains. **"Ideal state management" as a product category essentially does not exist.** What exists instead is:

1. **OKR tools** — track *goals* and *key results* but do not perform continuous gap analysis or AI-driven migration between states
2. **PRD tools** — generate *requirements documents* but do not track state progression or verify criteria completion
3. **Continuous improvement platforms** — automate *reporting* on improvement activities but do not define ideal states or orchestrate migration to them
4. **Miessler's Algorithm/PAI** — the only system that explicitly articulates "define ideal state -> snapshot current state -> continuously close gaps" as a first-class concept, but it is a *personal* framework, not a product

The conceptual vision that Miessler described — and that Adam has been operationally building with the Observer system — sits in a genuine vacuum. Nobody is building this as a platform.

**Confidence level: HIGH that the product category doesn't exist; MEDIUM that this represents an opportunity rather than a sign the market hasn't validated the concept.**

### Gap Analysis

1. **No "ideal state" as a first-class object.** OKR tools track objectives and key results. PRD tools track requirements. No tool treats "ideal state" as a persistent, evolving, verifiable object that drives continuous AI-mediated gap-closing.

2. **No continuous verification loop.** Existing tools are periodic — quarterly OKR reviews, sprint retrospectives, annual strategy reviews. Nobody has built the continuous loop that Miessler and Karpathy describe: define ideal -> measure current -> close gaps -> repeat.

3. **No Karpathy-style verifiability infrastructure.** Karpathy's core insight — that AI's power is proportional to verifiability, and verifiability requires tasks to be resettable, efficient, and rewardable — has been articulated but not implemented as a platform. The closest thing is CI/CD pipelines for code, but nobody has generalised this to arbitrary domains.

4. **No bridge between goal-tracking and agent orchestration.** OKR tools track goals. Agent orchestration platforms execute tasks. Nobody connects them — "here is the ideal state as defined in our strategy; here are the gaps; here are the agents assigned to close them; here is verification of progress."

5. **Viva Goals shutdown created a market disruption.** Microsoft retiring Viva Goals (December 2025) displaced a significant enterprise user base. Rhythms and Workpath are competing for these customers, but they are offering incremental improvements on OKRs, not the paradigm shift toward ideal state management.

### Observer Ecosystem Fit

**Adam's operational Observer system is the closest thing to ideal state management that exists.**

- **The Algorithm / PAI** (which Adam uses) already implements the define-ideal-state -> create-verifiable-criteria -> close-gaps loop. Adam has been *doing this operationally* with the Observer Council.
- **OIL's governance gates** provide the structured verification that the continuous loop requires
- **The Vault knowledge system** provides the persistent, evolving state representation that no OKR tool offers
- **The PRD system** within PAI already creates, tracks, and verifies ideal state criteria

**The fundamental question is whether this is a product or a methodology.** Miessler has articulated it as a framework (The Algorithm). Adam has implemented it operationally. But nobody has turned it into a product that others can use without deep AI literacy.

**Critical observation:** This domain has the largest gap between concept and implementation of any domain surveyed. There may be a reason for this — the concept may be too abstract for most buyers, or the tooling required may be too complex. Alternatively, it may simply be very early.

### Competitive Dynamics

**Adjacent players with potential to expand into this space:**
- Rhythms ($26M funded, AI-native OKR platform) — closest to ideal state management but currently just doing OKRs better
- Workpath / WorkBoard (consolidated, enterprise installed base)
- ChatPRD (AI-native requirements, could expand to verification)

**Conceptual leaders:**
- Daniel Miessler (The Algorithm / PAI) — the clearest articulation of the concept, open source, growing community
- Karpathy (verifiability concept) — influential thought leadership but no product

**Notable absence:** No funded startup is explicitly building "ideal state management" as a product. This is either whitespace or a warning sign. **[UNCERTAINTY: The absence of funded competition could indicate either genuine opportunity or that the concept doesn't translate to a sellable product.]**

---

## Domain 2D: Human Sovereignty / Anti-Capture Tooling

### Current Actors

#### Self-Hosted AI Infrastructure

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **Ollama** | Open source | Run LLMs locally with a single command. Supports DeepSeek-R1, Qwen 2.5, Llama 3.3. The de facto standard for local model execution. | [ollama.com](https://ollama.com/) |
| **Open WebUI** | Open source | Self-hosted AI interface supporting Ollama and OpenAI API. RAG with 9 vector databases. Complete offline operation. | [openwebui.com](https://openwebui.com/) |
| **n8n** | Open source (open-core) | Self-hosted workflow automation. Visual builder with custom JS nodes. Preserves data sovereignty while enabling complex multi-step logic. | [n8n.io](https://n8n.io/) |
| **Local AI Packaged** | Open source | Docker compose template bootstrapping Ollama + Open WebUI + n8n + Supabase in a single package. | [github.com/coleam00/local-ai-packaged](https://github.com/coleam00/local-ai-packaged) |

#### Sovereignty-Focused Agent Frameworks

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **Goose (Block/AAIF)** | Open source | Local-first AI agent framework. Works with any LLM (local or cloud). MCP-native. Now under AAIF governance. Reference implementation for MCP. | [github.com/block/goose](https://github.com/block/goose) |
| **Miessler PAI** | Open source | Personal AI Infrastructure framework. Claude Code native. Designed to "make the best AI available to everyone — not reserved for the rich or technical elite." | [github.com/danielmiessler/Personal_AI_Infrastructure](https://github.com/danielmiessler/Personal_AI_Infrastructure) |

#### Decentralised Identity / Self-Sovereign Identity

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **ERC-8004** | Ethereum standard | Decentralised identity + reputation + validation for AI agents. Complements x402 (Coinbase/Cloudflare) for agent payments. | [4sysops.com](https://4sysops.com/archives/what-is-erc-8004-ai-agents-build-trust-using-blockchain-technology/) |
| **EU EUDI Wallet (eIDAS 2.0)** | Government infrastructure | Digital credentials for all EU citizens by 2026. Self-sovereign identity at scale. | Referenced in identity search results |
| **ShareRing** | Commercial (crypto-adjacent) | Personal data vault. MeModule processes 80%+ of interactions on-device. Cryptographic PIN-gated confirmation for transactions. | [sharering.network](https://sharering.network/) |
| **DID/VC Research** | Academic | Researchers proposing DID + Verifiable Credentials for AI agents. Conceptual frameworks published on arXiv. | [arxiv.org](https://arxiv.org/html/2511.02841v1) |

#### Sovereignty-Preserving Forge Infrastructure

| Actor | Type | Description | URL |
|-------|------|-------------|-----|
| **Codeberg** | Non-profit | Democratic, community-driven software development platform. Codeberg e.V. (German non-profit). Forgejo-based. | [codeberg.org](https://codeberg.org/) |
| **Forgejo** | Open source | Community-governed forge software. Working on ActivityPub federation (ForgeFed). Star federation between instances built. Federation is experimental — moderation and access control still incomplete. v13.0 released October 2025. | [forgejo.org](https://forgejo.org/) |
| **Forgejo MCP Server** | Open source | MCP integration for Forgejo, enabling AI agents to interact with self-hosted forges. | [github.com/goern/forgejo-mcp](https://github.com/goern/forgejo-mcp) |
| **auditlm** | Open source | Self-hostable AI code review bot for Forgejo. Open-source alternative to CodeRabbit. | [github.com/ellenhp/auditlm](https://github.com/ellenhp/auditlm) |

#### National / Enterprise Sovereignty Initiatives

| Actor | Type | Scale | Description |
|-------|------|-------|-------------|
| **UK Sovereign AI Unit** | Government | Up to GBP 500M | National AI capability and security. Established July 2025. |
| **France-Germany Joint Initiative** | Government | Not disclosed | Sovereign AI with Mistral AI and SAP. Four pillars: sovereign ERP, AI financial management, digital agents, innovation labs. |
| **Canada Sovereign AI Compute** | Government | CAD 2B over 5 years | Domestic AI compute capacity. |
| **Microsoft Sovereign Cloud** | Enterprise | Corporate | Governance, productivity, large AI models running completely disconnected. February 2026 update. |
| **Nscale, CoreWeave, Carbon3ai** | Cloud providers | VC-funded | Niche sovereign cloud workloads. Emerged as significant players in 2025. |

### Maturity Assessment

**Overall maturity: Bifurcated (national/enterprise sovereignty is maturing rapidly; individual/small-team sovereignty is primitive)**

There are really two different markets here:

1. **National/Enterprise sovereignty:** Rapidly maturing. Billions in government funding. 71% of executives call sovereign AI "an existential concern or strategic imperative" (McKinsey). The sovereign cloud market is expected to take off in 2026. This is a serious, well-funded, accelerating market — but it is about *national/organisational* sovereignty, not *individual* sovereignty.

2. **Individual/small-team sovereignty:** Almost entirely limited to "run Ollama locally." The tooling stack is: local models (Ollama) + local interface (Open WebUI) + maybe local automation (n8n). There is no governance layer, no structured oversight, no federation, no community knowledge sharing. Miessler's PAI framework and Block's Goose are the closest to a complete individual sovereignty stack, but neither provides governance *of* the AI system itself.

**The gap between these two tiers is enormous.** Enterprise sovereignty gets IBM and Microsoft. Individual sovereignty gets Docker Compose files.

**Confidence level: HIGH for national/enterprise trends; HIGH for the self-hosted tooling landscape; MEDIUM-LOW for the individual sovereignty market opportunity.**

### Gap Analysis

1. **No governance for self-hosted AI.** You can run Ollama locally, but there are no guardrails, no audit trails, no structured decision-making, no quality verification. Individual sovereignty means "you're on your own."

2. **No federation between sovereign instances.** Forgejo is building forge federation via ActivityPub, but it is experimental and incomplete. Nobody is building federation for AI agent tooling — the ability for sovereign instances to discover each other's capabilities, share solutions, and collaborate without centralisation.

3. **No sovereignty *framework* or *methodology*.** Enterprise sovereignty has frameworks (Singapore MGF, EU AI Act, Microsoft Sovereign Cloud). Individual sovereignty has none — no structured approach to "how do I set up sovereign AI infrastructure that respects my values and governance preferences."

4. **No market for individual sovereignty consulting.** The sovereignty consulting market is entirely enterprise/government-focused. There is no equivalent of "set up your personal sovereign AI infrastructure" as a service offering. **[UNCERTAINTY: This could be because no market exists, or because no one has tried to create one yet.]**

5. **The Forgejo/Codeberg ecosystem is cautious about AI.** The Forgejo community is actively debating whether to allow AI-generated contributions at all. This philosophical tension means the fediverse approach to AI tooling may be slow to develop.

### Observer Ecosystem Fit

**Adam's entire stack is the individual sovereignty stack that doesn't exist yet.**

- **OIL** provides the governance layer that self-hosted AI lacks (Gap #1)
- **Observer Commons** provides the federation protocol that doesn't exist (Gap #2)
- **Observer Council** provides the structured decision-making that individual sovereignty needs (Gap #1)
- **The Vault system** provides persistent knowledge management that no self-hosted tool offers (knowledge sovereignty)
- **PAI operational patterns** provide the *methodology* that doesn't exist (Gap #3)

The Observer ecosystem is, architecturally, exactly what the individual sovereignty gap demands. The question is whether there are enough people who:
(a) care about individual AI sovereignty,
(b) have the technical capacity to use such a system, and
(c) are willing to pay for it (or contribute to it as open source).

**Risk assessment:** The individual sovereignty market may be too small or too technically demanding for a sustainable project. The enterprise sovereignty market is larger but requires sales infrastructure Adam doesn't have.

### Competitive Dynamics

**National/Enterprise (well-funded):**
- Microsoft, IBM, Oracle — corporate sovereign cloud
- Nscale, CoreWeave — sovereign cloud startups
- Government programs (UK, France-Germany, Canada) — direct funding

**Individual sovereignty (community-driven):**
- Ollama (dominant for local models)
- Open WebUI (dominant for local interfaces)
- Goose/Block (local-first agent framework, AAIF-backed)
- Miessler PAI (personal AI infrastructure, growing community)
- n8n (workflow automation, open-core model)

**Sovereignty infrastructure:**
- Codeberg/Forgejo (non-profit, community-governed)
- ERC-8004 / DID standards (decentralised identity)

**Key dynamic:** The individual sovereignty space is almost entirely community-driven with no significant VC funding. This is both the opportunity (no well-funded competitors) and the risk (the market may not be commercially viable).

---

## Cross-Domain Patterns

### Pattern 1: The Governance Gap Is Universal

Across all four domains, the same structural gap appears: **infrastructure exists but governance doesn't.** MCP provides tool discovery but not quality governance. Agent orchestration platforms provide execution but not decision governance. Self-hosted AI provides independence but not structured oversight. OKR tools provide goal tracking but not state governance.

The Observer ecosystem's primary value proposition — structured governance for AI-human collaboration — addresses the gap that appears everywhere.

### Pattern 2: Federation Is Wanted But Not Built

MCP Registry is designed for federation. Forgejo is building toward federation. A2A enables agent-to-agent discovery. But actual federation — sovereign instances sharing knowledge while maintaining autonomy — remains largely theoretical. Observer Commons' federated solution sharing protocol sits in a genuine architectural vacuum.

### Pattern 3: Corporate vs. Community Bifurcation

Every domain splits between well-funded corporate solutions (enterprise-only, proprietary) and community-driven alternatives (limited, under-resourced). There is almost nothing in the middle — sophisticated but community-governed, production-quality but sovereignty-preserving. This middle ground is where Adam's philosophical stance ("AI articulates, humans decide," anti-corporate, open-source) naturally positions the Observer ecosystem.

### Pattern 4: Complexity-Aware Governance Is Absent

Nobody is classifying AI agent tasks by complexity domain. Nobody is applying different governance levels to different task types. This is surprising given that Cynefin has been a well-known framework in management consulting for over two decades. The application of complexity science to AI agent governance represents genuine intellectual whitespace.

### Pattern 5: Verification Is the Bottleneck

Karpathy's insight that "AI verifying doesn't scale because verifying AI output involves much more than just typing" appears across every domain. MCP registries can't verify service quality at scale. Governance platforms can't verify agent decisions at scale. OKR tools can't verify goal achievement at scale. The gap between "AI can do things" and "we can verify AI did things correctly" is the fundamental constraint.

---

## Whitespace Summary

Ranked by intersection with Observer ecosystem capabilities:

1. **Complexity-aware governance framework for AI agents** (Domain 2B, Gap #1) — No one is building this. Observer Council with Cynefin gates is the only known implementation.

2. **Federated, sovereignty-preserving solution discovery** (Domain 2A, Gap #2) — MCP Registry architecture supports it; nobody has built the community governance layer. Observer Commons maps directly.

3. **Ideal state management as a product category** (Domain 2C, Gaps #1-4) — The concept exists (Miessler, Karpathy); zero products exist. Adam's operational implementation is one of very few real-world examples.

4. **Governance layer for self-hosted AI** (Domain 2D, Gap #1) — OIL provides exactly this. No competitor.

5. **Open-source governance framework (not just guardrails)** (Domain 2B, Gap #3) — Superagent and OpenGuardrails prevent bad outcomes; nothing structures good decision-making. Observer Council is a governance *framework*, not just a safety net.

6. **Bridge between goal-tracking and agent orchestration** (Domain 2C, Gap #4) — Nobody connects strategy (ideal state) to execution (agent orchestration) to verification (criteria checking). The PAI Algorithm does this by design.

---

## Surprising Findings

1. **Cynefin is completely absent from AI governance.** Despite being a well-established framework for decision-making under complexity, and despite AI agent orchestration being an obvious application of complexity science, nobody has integrated Cynefin or any formal complexity classification into AI governance tooling. This is the single largest intellectual whitespace found in this research.

2. **The MCP Registry was designed for federation from the start.** The MCP team explicitly describes it as a "primary source of truth" that sub-registries can mirror and extend. This is architecturally closer to Observer Commons' vision than expected — the protocol layer already supports what Adam wants to build. The opportunity is in the *governance and quality layer* on top, not the protocol itself.

3. **"Ideal state management" is a complete vacuum.** Despite Miessler's articulation, Karpathy's verifiability concept, and the obvious utility of "define ideal state -> close gaps continuously," no product exists in this category. The nearest products (OKR tools) are periodic review tools, not continuous state-migration platforms.

4. **Individual sovereignty tooling peaked at "run models locally."** The self-hosted AI movement stopped at inference. Nobody has built governance, federation, structured oversight, or community knowledge sharing for sovereign AI instances. It is as if the sovereignty movement declared victory at "I can run a chatbot on my laptop" without addressing any of the harder problems.

5. **Enterprise governance spending is projected to 10x in 4 years** ($492M in 2026 to $1B+ by 2030, with broader GRC reaching much higher). The commercial opportunity is real and growing rapidly — but it is currently captured by enterprise SaaS vendors with sales teams and VC backing.

6. **ERC-8004 deployed 20,000+ AI agents in two weeks.** The blockchain ecosystem's approach to agent identity and reputation — three interlocking registries for identity, reputation, and validation — is architecturally more sophisticated than anything in the traditional tech stack. Whether it achieves mainstream adoption is uncertain, but the *design* is worth studying.

7. **The Forgejo community is actively hostile to AI contributions.** The sovereignty-focused forge ecosystem that would be a natural ally for sovereignty-preserving AI tooling is debating whether to accept AI-generated code at all. This philosophical tension is a potential obstacle for any AI tooling project seeking to align with the fediverse/Codeberg community.

---

## Limitations & Uncertainty

### High-Confidence Findings
- The MCP ecosystem's structure, governance, and major players
- Market size projections from Gartner, Deloitte, McKinsey (multiple independent sources)
- The existence (or absence) of product categories described
- Technical capabilities of specific tools and platforms

### Medium-Confidence Findings
- Adoption rates for newer platforms (Airia's "300 customers" claim is self-reported)
- The trajectory of blockchain-based agent identity (ERC-8004) — technically interesting but adoption unclear
- Whether the "ideal state management" vacuum represents opportunity or market rejection
- Forgejo federation timeline and viability

### Low-Confidence / Speculative
- Whether individual AI sovereignty is a viable *market* vs. a niche community interest
- Whether complexity-aware governance is genuinely wanted by enterprise buyers or is an academic/consulting concept
- Whether the middle ground between enterprise SaaS and community tools can sustain a project
- How quickly well-funded enterprise players (Airia, Credo AI, IBM) will expand into currently empty spaces

### Methodology Limitations
- Research conducted primarily via web search on 2 March 2026. Rapidly changing landscape means some information may be days-to-weeks outdated
- Enterprise product capabilities described based on marketing materials and third-party reviews, not hands-on evaluation
- Open source project assessments based on README files and release notes, not code review
- Market size projections come from analyst firms with known incentives to project growth
- Some actors may have been missed — the landscape is fragmented and new players emerge weekly

---

## Sources

### Domain 2A: Service Directories
- [MCP Registry (Official)](https://registry.modelcontextprotocol.io/)
- [Anthropic: Donating MCP and Establishing AAIF](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation)
- [MCP Joins the Linux Foundation (GitHub Blog)](https://github.blog/open-source/maintainers/mcp-joins-the-linux-foundation-what-this-means-for-developers-building-the-next-era-of-ai-tools-and-agents/)
- [Kong MCP Registry Announcement](https://www.prnewswire.com/news-releases/kong-introduces-mcp-registry-in-kong-konnect-to-power-ai-connectivity-for-agent-discovery-and-governance-302676451.html)
- [IBM ContextForge (GitHub)](https://github.com/IBM/mcp-context-forge)
- [MCP Gateway & Registry (GitHub)](https://github.com/agentic-community/mcp-gateway-registry)
- [Agent2Agent Protocol (Google Developers Blog)](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [A2A Protocol (GitHub)](https://github.com/a2aproject/A2A)
- [Linux Foundation Launches A2A Project](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents)
- [ERC-8004 — AI Agent Identity on Blockchain](https://4sysops.com/archives/what-is-erc-8004-ai-agents-build-trust-using-blockchain-technology/)
- [Introducing the MCP Registry (InfoQ)](https://www.infoq.com/news/2025/09/introducing-mcp-registry/)
- [MCP Registry: Federated Discovery Layer (MarkTechPost)](https://www.marktechpost.com/2025/09/09/mcp-team-launches-the-preview-version-of-the-mcp-registry-a-federated-discovery-layer-for-enterprise-ai/)
- [Smithery](https://smithery.ai/)
- [PulseMCP](https://www.pulsemcp.com/)
- [MCP Gateways in 2026 (Medium)](https://bytebridge.medium.com/mcp-gateways-in-2026-top-10-tools-for-ai-agents-and-workflows-d98f54c3577a)

### Domain 2B: Governance-as-a-Service
- [Gartner: AI Governance Spending Projections](https://www.gartner.com/en/newsroom/press-releases/2026-02-17-gartner-global-ai-regulations-fuel-billion-dollar-market-for-ai-governance-platforms)
- [Gartner: 40% Enterprise Apps with AI Agents by 2026](https://www.gartner.com/en/newsroom/press-releases/2025-08-26-gartner-predicts-40-percent-of-enterprise-apps-will-feature-task-specific-ai-agents-by-2026-up-from-less-than-5-percent-in-2025)
- [Credo AI](https://www.credo.ai/)
- [Airia: $100M Funding](https://airia.com/airia-secures-100m-in-funding/)
- [Airia: AI Governance Launch](https://airia.com/airia-launches-ai-governance-capabilities/)
- [Deloitte: Agentic AI Market Forecast ($35B by 2030)](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/ai-agent-orchestration.html)
- [MIT Technology Review: From Guardrails to Governance](https://www.technologyreview.com/2026/02/04/1131014/from-guardrails-to-governance-a-ceos-guide-for-securing-agentic-systems/)
- [Singapore MGF for Agentic AI](https://www.imda.gov.sg/resources/press-releases-factsheets-and-speeches/press-releases/2026/new-model-ai-governance-framework-for-agentic-ai)
- [NIST AI Agent Standards Initiative](https://www.pillsburylaw.com/en/news-and-insights/nist-ai-agent-standards.html)
- [Superagent (GitHub)](https://github.com/superagent-ai/superagent)
- [OpenGuardrails](https://openguardrails.com/)
- [NVIDIA NeMo Guardrails (GitHub)](https://github.com/NVIDIA-NeMo/Guardrails)
- [Meta LlamaFirewall](https://ai.meta.com/research/publications/llamafirewall-an-open-source-guardrail-system-for-building-secure-ai-agents/)
- [Atlan: Top AI Governance Tools 2026](https://atlan.com/ai-governance-tools/)
- [Vectra: AI Governance Tools 2026](https://www.vectra.ai/topics/ai-governance-tools)
- [IAPP: AI Governance in the Agentic Era](https://iapp.org/resources/article/ai-governance-in-the-agentic-era)
- [Human-in-the-Loop to Human-on-the-Loop (Medium)](https://bytebridge.medium.com/from-human-in-the-loop-to-human-on-the-loop-evolving-ai-agent-autonomy-c0ae62c3bf91)
- [OneReach: Human-in-the-Loop Agentic AI](https://onereach.ai/blog/human-in-the-loop-agentic-ai-systems/)
- [Anticapture Framework](https://knowledge.superbenefit.org/links/Anticapture)

### Domain 2C: Ideal State Management
- [Daniel Miessler: AI's Ultimate Use Case (State Management)](https://danielmiessler.com/blog/ai-state-management)
- [Daniel Miessler: The Algorithm (GitHub)](https://github.com/danielmiessler/TheAlgorithm)
- [Daniel Miessler: Pursuing The Algorithm](https://danielmiessler.com/blog/the-last-algorithm)
- [Daniel Miessler: AI Changes 2026](https://danielmiessler.com/blog/ai-changes-2026)
- [Daniel Miessler: PAI (GitHub)](https://github.com/danielmiessler/Personal_AI_Infrastructure)
- [Daniel Miessler: Generalised Hill-Climbing](https://danielmiessler.com/blog/nobody-is-talking-about-generalized-hill-climbing)
- [Karpathy: Verifiability](https://karpathy.bearblog.dev/verifiability/)
- [O'Reilly: Software 2.0 Means Verifiable AI](https://www.oreilly.com/radar/software-2-0-means-verifiable-ai/)
- [Coherenceism: Verification as Velocity](https://coherenceism.blog/2025-11-18-verification-as-velocity/)
- [Rhythms AI](https://www.rhythms.ai/)
- [Workpath: Enterprise Strategy Execution](https://www.workpath.com/en/magazine/ai-strategy-execution-platforms-enterprise)
- [ChatPRD](https://www.chatprd.ai/)
- [Impruver](https://impruver.com/)

### Domain 2D: Human Sovereignty
- [Ollama with Open WebUI](https://www.glukhov.org/post/2026/01/open-webui-overview-quickstart-and-alternatives/)
- [Open WebUI](https://openwebui.com/)
- [Goose (Block/AAIF)](https://github.com/block/goose)
- [LLM Self-Hosting and AI Sovereignty](https://www.glukhov.org/post/2026/02/llm-selfhosting-and-ai-sovereignty/)
- [Self-Hosted LLMs in 2026](https://createaiagent.net/self-hosted-llm/)
- [Local AI Agents: Goose, Observer AI, AnythingLLM](https://aimultiple.com/local-ai-agent)
- [Local AI Packaged (GitHub)](https://github.com/coleam00/local-ai-packaged)
- [Codeberg](https://codeberg.org/)
- [Forgejo](https://forgejo.org/)
- [Forgejo: AI Contributions Discussion](https://codeberg.org/forgejo/discussions/issues/366)
- [Forgejo MCP Server](https://github.com/goern/forgejo-mcp)
- [auditlm (GitHub)](https://github.com/ellenhp/auditlm)
- [McKinsey: Sovereign AI Agenda](https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/tech-forward/the-sovereign-ai-agenda-moving-from-ambition-to-reality)
- [Computer Weekly: Sovereign Cloud 2026](https://www.computerweekly.com/feature/Sovereign-cloud-and-AI-services-tipped-for-take-off-in-2026)
- [WEF: Shared Infrastructure for Sovereign AI](https://www.weforum.org/stories/2026/02/shared-infrastructure-ai-sovereignty/)
- [SoftwareOne: Digital Sovereignty 2026](https://www.softwareone.com/en-us/blog/articles/2026/01/12/your-2026-digital-sovereignty-guide)
- [AI Agents with DIDs and VCs (arXiv)](https://arxiv.org/html/2511.02841v1)
- [ShareRing: Sovereign AI Identity](https://sharering.network/2026/02/09/digital-me-the-identity-anchored-evolution-of-sovereign-ai/)
- [ERC-8004 and KYA](https://www.biometricupdate.com/202601/kya-emerges-as-essential-tool-to-ensure-agentic-ai-is-trustworthy)
- [Kleppmann: AI Will Make Formal Verification Mainstream](https://martin.kleppmann.com/2025/12/08/ai-formal-verification.html)

### Market Data
- [Gartner: AI Governance Spending ($492M 2026, $1B+ 2030)](https://www.gartner.com/en/newsroom/press-releases/2026-02-17-gartner-global-ai-regulations-fuel-billion-dollar-market-for-ai-governance-platforms)
- [Deloitte: Agentic AI Market ($8.5B 2026, $35B 2030)](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/ai-agent-orchestration.html)
- [McKinsey: Agentic Commerce ($3-5T Global by 2030)](https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/reimagining-the-value-proposition-of-tech-services-for-agentic-ai)
- [AAIF Formation Announcement](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)

---

*"AI articulates, humans decide." — This document presents landscape intelligence for Adam's consideration. No actions have been taken and no commitments made.*
