---
meta_version: 1
kind: decision
status: draft
authority: high
domain: [control-plane]
source: adam_decision
confidence: confirmed
mode: design
created: 2026-02-28T17:00:00+11:00
modified: 2026-02-28T17:00:00+11:00
cssclasses: [status-draft]
motifs: [observer-control-plane, architecture-decisions]
refs:
  - 01-Projects/observer-council/architecture/Technical_Design_Specification_v2.md
---

# Decision Record: TDS v2 Open Questions (Q1-Q8)

**Date:** 2026-02-28
**Decided by:** Adam (Observer)
**Context:** Resolving TDS v2 Section 9 open questions before PRD generation.
**Prior discussion:** Claude.ai chat "TDS v2 security architecture decisions" (2026-02-26), continued 2026-02-28.

---

## Q1: Accept Operator's 7-Point Minimal Phase 1?

**Decision: YES — accepted.**

Phase 1 scope:
1. Single monorepo (not two repos)
2. HTTP-only transport (no WebSocket)
3. Mode 1 dispatch only (human specifies backend)
4. Flat directory structure (4-5 directories per package)
5. curl scripts for CLI interaction (no TUI tool)
6. Node.js 22 LTS only (no Bun runtime split)
7. Thread model only (defer full Session > Thread > Turn > Item hierarchy until multi-client)

**Rationale:** Build the smallest thing that proves the architecture works. Complexity can be added once the foundation is proven.

---

## Q2: Credential Isolation Approach?

**Decision: Phase 1 environment sanitization. Phase 2 bubblewrap (elevated priority).**

Phase 1: `sanitizedEnv()` constructs minimal environment from scratch for all child processes. This is a Node.js runtime guarantee — child processes literally cannot see credentials not in the curated env object. Combined with `validateArgs()` and dual-layer output sanitization.

Phase 2: Bubblewrap namespace isolation replaces the VM-boundary credential separation. Elevated from "nice to have" to "important" because single-host is the canonical deployment model.

**Rationale:** Env sanitization covers the real-world risk (accidental leakage, as demonstrated by the Feb 2026 API key incident). Bubblewrap provides structural isolation for distribution to other users who won't have VM infrastructure.

---

## Q3: Two VMs or Single VM?

**Decision: SINGLE HOST is the canonical deployment model.**

This is not just "collapse to one VM for convenience." The architectural position is:

- **Single-host is the primary deployment target.** The system must work on one machine — laptop, home server, or VPS.
- **Two-VM becomes an optional hardening guide**, not a requirement. Documented for users who happen to have Proxmox or similar infrastructure.
- **All security guarantees must come from application-level mechanisms** that work on any Linux box, not from VM boundaries.
- **Cross-VM communication is removed from Phase 1 scope.** Control plane and dispatch communicate over localhost.

**Rationale:** If this is released as open source, nobody is going to set up multiple VMs just to run it. The architecture must work for a single user on a single machine. VM isolation is defense-in-depth for those who want it, not a requirement.

**Impact on TDS v2:**
- Section 2.6 (Two-VM Split) becomes an optional hardening appendix
- Section 3f (Router/Core Client) simplifies to localhost communication
- Section 3i (Cross-VM Internal Protocol) moves to optional appendix
- Section 5.3 (Network Security) simplifies — no Tailscale requirement
- Section 7.4 (Startup Sequence) simplifies — one systemd service set
- All cross-VM timeout alignment logic becomes unnecessary for default deployment

---

## Q4: Backend Sandboxing Timing?

**Decision: Bubblewrap elevated to late Phase 1 or early Phase 2.**

Originally deferred to Phase 2 as a nice-to-have. Now elevated because:
- Single-host deployment means no VM boundary for credential isolation
- Bubblewrap is a single package install (`bwrap`) — practical for distribution
- It replaces VM isolation for every user who isn't running Proxmox
- Namespace isolation is almost as good as separate VMs with zero infrastructure overhead

**Rationale:** For open source distribution, bubblewrap is what makes single-host secure enough. It's the mechanism that lets the project run safely on someone else's laptop.

---

## Q5: Approval Tier Assignments — How Conservative?

**Decision: Start permissive. Auto-approve read-only and analysis operations. Require approval only for code execution, file modification, and external API calls.**

Calibrate based on real usage patterns in Phase 1. It is easier to add gates than to remove approval fatigue.

**Rationale:** Sentry's pre-mortem Scenario 3 — 30-50 approval prompts per session leads to rubber-stamping, which defeats the purpose of human oversight entirely.

---

## Q6: Secret Management Tool?

**Decision: age.**

Simple, single binary, no daemon, no GPG complexity. One key, one command. Fits solo operator profile and is easy for other users to adopt.

**Rationale:** pass requires GPG (complexity tarpit), sops is designed for team/cloud workflows, systemd-creds is machine-specific. age is the simplest tool that meets the requirements.

---

## Q7: Single-VM Collapse Implications?

**Decision: Resolved by Q3. Credential isolation addressed by Q2 and Q4.**

Since single-host is canonical:
- Phase 1: `sanitizedEnv()` provides application-level credential isolation
- Phase 2: Bubblewrap provides structural namespace isolation
- Optional: Dedicated service user (`observer`) for production hardening
- Optional: VM separation for users with Proxmox infrastructure

No additional architectural changes needed beyond Q2 and Q4.

---

## Q8: Cross-VM Auth Strategy?

**Decision: Not applicable for Phase 1. Localhost communication only.**

Cross-VM auth (Bearer tokens, mTLS) moves to the optional hardening guide for multi-VM deployments. Phase 1 services communicate over localhost — no network auth needed between control plane and dispatch.

If a user deploys across VMs later, the hardening guide documents Bearer token auth (Phase 1 equivalent) and mTLS (Phase 2 equivalent).

---

## Summary

| Question | Decision | Status |
|----------|----------|--------|
| Q1: Minimal Phase 1 | Yes, 7-point scope | **Confirmed** |
| Q2: Credential isolation | Phase 1 env sanitization, Phase 2 bubblewrap | **Confirmed** |
| Q3: VM architecture | Single-host canonical, two-VM optional | **Confirmed** |
| Q4: Bubblewrap timing | Elevated to late Phase 1 / early Phase 2 | **Confirmed** |
| Q5: Approval tiers | Start permissive | **Confirmed** |
| Q6: Secret management | age | **Confirmed** |
| Q7: Single-VM implications | Resolved by Q2 + Q4 | **Resolved** |
| Q8: Cross-VM auth | N/A for Phase 1 (localhost) | **Resolved** |

**All TDS v2 Section 9 open questions are now resolved. PRD generation is unblocked.**
