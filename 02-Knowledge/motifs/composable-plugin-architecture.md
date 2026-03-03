---
name: "Composable Plugin Architecture"
tier: 1
status: provisional
confidence: 0.3
source: "bottom-up"
domain_count: 3
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

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Dual-Speed Governance | complement | Plugin interfaces are defined at governance speed (slow, deliberate); plugin composition happens at operational speed (fast, per-deployment) |
| Scaffold-First Architecture | complement | The plugin architecture's core is a scaffold that gains substance through plugin composition |

## Discovery Context

Identified through bottom-up analysis of the 112-repo OCP scraper corpus during the triad run (2026-03-03). The pattern appeared independently in browser extension frameworks (Extension.js), authentication middleware (OmniAuth's strategy pattern, next-auth's providers), and CLI frameworks (Bashly, picocli, Vorpal). In each case, the system's extensibility comes from defining a minimal core with explicit extension points rather than from modifying a monolithic codebase.

## Falsification Conditions

- If the "plugin interface" is so broad that plugins must understand core internals to function (leaky abstraction), the composition is nominal — plugins are really patches, not independent units
- If the system has only one plugin and no realistic path to multiple plugins, this is just "separation of concerns" not a composition pattern
- If removing the plugin architecture and inlining the behavior produces equivalent or simpler code with no loss of extensibility, the architecture is premature abstraction — not a structural motif
