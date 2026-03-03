---
name: "Composable Plugin Architecture"
tier: 1
status: provisional
confidence: 0.9
source: "triangulated"
domain_count: 7
created: 2026-03-03
updated: 2026-03-03
---

# Composable Plugin Architecture

## Structural Description

A system defines a minimal core with explicit extension points where plugins can be composed to add behavior. Plugins conform to a shared interface contract but are independently authored, loaded, and composed. The core does not know what plugins exist — it only knows the interface shape. Composition is the primary means of adding functionality: rather than modifying the core, new behavior is assembled by combining plugins that each handle one concern.

## Domain-Independent Formulation

A minimal core with interface-defined extension points where independently authored plugins compose to create system behavior.

## Instances

### Instance 1: Browser Extension Frameworks (Extension.js)
- **Domain:** Browser Extension Development
- **Expression:** Extension.js provides a minimal cross-browser core that defines extension points (content scripts, background workers, popups, devtools panels). Each capability is a composable plugin that conforms to the manifest interface. Developers compose extensions by selecting and combining these plugins — the framework's core doesn't contain any browser-specific behavior, only the composition machinery.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — web-development: extension-js/extension.js)

### Instance 2: Authentication Strategy Composition (OmniAuth, next-auth)
- **Domain:** Authentication
- **Expression:** OmniAuth defines a minimal Rack middleware core with a strategy interface. Each authentication provider (OAuth, SAML, LDAP) is an independently authored plugin conforming to the strategy contract. Authentication behavior is composed by stacking strategies — the core handles the plugin lifecycle (initialization, callback routing, failure handling) while strategies handle provider-specific logic. next-auth follows the same pattern with its provider plugin system.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — lang:ruby: omniauth/omniauth; web-development: nextauthjs/next-auth)

### Instance 3: CLI Command Composition (Bashly, picocli, Vorpal)
- **Domain:** CLI Frameworks
- **Expression:** Bashly generates CLI applications from a YAML-declared command tree where each command is a composable unit with its own flags, arguments, and handler. picocli and Vorpal similarly define a minimal runtime core with command plugins that compose into the final CLI. Adding a new command doesn't modify the core — it adds a new plugin that the composition machinery discovers and wires.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — developer-tools: bashly-framework/bashly, remkop/picocli, dthree/vorpal)

### Instance 4: Web Framework Middleware (Ts.ED, Amber)
- **Domain:** Web Framework / Server-Side
- **Expression:** Ts.ED (TypeScript) defines a minimal core with decorator-based extension points where middleware, controllers, and interceptors are independently authored plugins that compose into the request pipeline. Each middleware conforms to the decorator interface contract; the core discovers and wires them without knowing their internals. Amber (Crystal) follows the same pattern with its pipe-based middleware composition — each pipe is an independent plugin that the framework composes into the request/response lifecycle. Adding a new middleware/pipe doesn't modify the framework core; it adds a composable unit the machinery discovers.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — web-development: tsedio/tsed, amberframework/amber)

### Instance 5: Game Engine Plugin Systems (Bottom-Up — Bevy, A-Frame, GDevelop)
- **Domain:** Game Engine Architecture
- **Expression:** Bevy's entire architecture is plugin-based — `App::new().add_plugins(DefaultPlugins)` means even default functionality (rendering, input, audio, windowing) is a plugin conforming to the `Plugin` trait. The core is genuinely minimal (ECS scheduler + plugin loader); ALL behavior comes from composed plugins. A-Frame's WebVR component system treats each entity attribute as a composable component with a defined interface. GDevelop's extension/behavior system allows independently authored behaviors to compose into game objects. In each case, adding functionality means adding a plugin, not modifying the core.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — game-development: bevyengine/bevy 45k★, aframevr/aframe 17k★, 4ian/GDevelop 21k★)

### Instance 6: Digital Audio Workstation Plugin Hosting (Bottom-Up — Zrythm)
- **Domain:** Music Production / Audio Engineering
- **Expression:** Zrythm supports 7 plugin standards (LV2, CLAP, VST2, VST3, AU, LADSPA, DSSI) — the DAW IS a plugin host. Its entire purpose is composing independently authored audio plugins into signal chains. Each plugin conforms to a standard interface contract. The core (audio engine, transport, routing) contains no audio processing logic — ALL processing comes from composed plugins. Optional plugin sandboxing (bridging) proves the independence of plugins from the core. This is the STRONGEST instance of composable plugin architecture across the entire OCP corpus — the system's entire value proposition is plugin composition.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — music-production: zrythm/zrythm 2.9k★)

### Instance 7: Bioinformatics Pipeline Composition (Bottom-Up — Nextflow, GATK)
- **Domain:** Bioinformatics / Computational Biology
- **Expression:** Nextflow pipelines are composed of process modules with defined I/O channel interfaces. Each process is independently authored and handles domain-specific logic (alignment, variant calling, annotation); the Nextflow core handles execution, scheduling, and caching. You can swap one aligner process for another without touching the pipeline core. GATK's walker framework defines a tool interface where each tool (HaplotypeCaller, Mutect2) is an independently authored plugin conforming to the walker contract — the engine provides traversal, tools provide analysis. Note: pipeline stages have LESS formal interface contracts than audio plugins (VST) or game plugins (Bevy Plugin trait), making this a moderate rather than strong instance.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — bioinformatics: nextflow-io/nextflow 3.3k★, broadinstitute/gatk 1.9k★)

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Dual-Speed Governance | complement | Plugin interfaces are defined at governance speed (slow, deliberate); plugin composition happens at operational speed (fast, per-deployment) |
| Scaffold-First Architecture | complement | The plugin architecture's core is a scaffold that gains substance through plugin composition |

## Discovery Context

**Bottom-up (2026-03-03, first triad run):** Identified through analysis of the 112-repo OCP scraper corpus. The pattern appeared independently in browser extension frameworks (Extension.js), authentication middleware (OmniAuth, next-auth), CLI frameworks (Bashly, picocli, Vorpal), and web framework middleware (Ts.ED, Amber).

**Bottom-up (2026-03-03, alien domain triad run):** Confirmed across 3 alien domains with 91 additional repos. Game engines (Bevy's Plugin trait, A-Frame's component system, GDevelop's behaviors), music production (Zrythm's 7-standard plugin host — STRONGEST instance), and bioinformatics (Nextflow process modules, GATK walker framework — moderate instance).

**Triangulation confirmed:** The pattern was first found bottom-up in infrastructure repos, then confirmed bottom-up in alien domains that have zero overlap with infrastructure. The music production instance (Zrythm) predates modern software engineering — audio plugin standards (VST, LADSPA) have existed for 25+ years, suggesting this motif was NOT borrowed from software infrastructure.

## Confidence Score Arithmetic

| Step | Event | Change | Running Total |
|------|-------|--------|---------------|
| 1 | Motif created with Instance 1 (Browser Extensions) | Start at 0.1 | 0.1 |
| 2 | Instance 2 added (Authentication) | +0.1 | 0.2 |
| 3 | Instance 3 added (CLI Frameworks) | +0.1 | 0.3 |
| 4 | Instance 4 added (Web Frameworks) | +0.1 | 0.4 |
| 5 | Instance 5 added (Game Engines, alien) | +0.1 | 0.5 |
| 6 | Instance 6 added (Music Production, alien) | +0.1 | 0.6 |
| 7 | Instance 7 added (Bioinformatics, alien) | +0.1 | 0.7 |
| 8 | Triangulation confirmed (infra + alien bottom-up) | +0.2 | 0.9 |

**Final: 0.9.** 7 domain instances (0.1 start + 6 × 0.1 = 0.7) + triangulation bonus (0.2) = 0.9.

## Falsification Conditions

- If the "plugin interface" is so broad that plugins must understand core internals to function (leaky abstraction), the composition is nominal — plugins are really patches, not independent units
- If the system has only one plugin and no realistic path to multiple plugins, this is just "separation of concerns" not a composition pattern
- If removing the plugin architecture and inlining the behavior produces equivalent or simpler code with no loss of extensibility, the architecture is premature abstraction — not a structural motif
