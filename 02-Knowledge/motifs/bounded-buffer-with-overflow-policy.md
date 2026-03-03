---
name: "Bounded Buffer With Overflow Policy"
tier: 1
status: provisional
confidence: 0.4
source: "bottom-up"
domain_count: 4
created: 2026-03-03
updated: 2026-03-03
---

# Bounded Buffer With Overflow Policy

## Structural Description

A system allocates a fixed-size buffer for incoming data and defines an explicit policy for what happens when the buffer is full. The overflow policy (evict oldest, reject new, spill to disk, apply backpressure) is a first-class design decision rather than an error condition. The bounded buffer constrains resource consumption while the overflow policy determines system behavior at the boundary.

## Domain-Independent Formulation

A finite container with an explicit, policy-governed behavior at its capacity boundary.

## Instances

### Instance 1: In-Memory Caching (BigCache, Trickster)
- **Domain:** Data Management / Caching
- **Expression:** BigCache allocates fixed-size memory segments and evicts entries via FIFO when full — the eviction policy is a constructor parameter, not an afterthought. Trickster's caching proxy likewise bounds cache size and defines overflow behavior (evict by TTL, by size). The buffer boundary is designed, not discovered through OOM crashes.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — data-management: allegro/bigcache; developer-tools: trickstercache/trickster)

### Instance 2: Message Transport (libatbus)
- **Domain:** Inter-Process Communication
- **Expression:** libatbus implements bounded message queues between processes with configurable overflow behavior — when the send buffer fills, the policy determines whether to block the sender (backpressure), drop messages, or expand. The buffer limit and overflow handling are explicit configuration, not implicit failures.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — data-management: owent/libatbus)

### Instance 3: Profiling Data Ingestion (Pyroscope, HyperDX)
- **Domain:** Observability / Profiling
- **Expression:** Continuous profiling systems ingest high-volume flame graph data into bounded storage. Pyroscope uses time-based retention with configurable compaction — when storage fills, older profiles are downsampled or dropped per a defined retention policy. HyperDX bounds log ingestion with rate limits and overflow-to-cold-storage. The ingestion boundary is a policy, not a crash.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — devops: grafana/pyroscope; web-development: hyperdxio/hyperdx)

### Instance 4: Message Queuing (RobustMQ, miniqueue, mangos)
- **Domain:** Message Queuing / Broker
- **Expression:** Message brokers allocate bounded queue depth per topic or channel and define explicit overflow policies: reject-publish (backpressure to producer), dead-letter routing, or drop-oldest. RobustMQ implements configurable per-queue memory and disk limits with overflow-to-disk spill. miniqueue bounds its in-memory queue and blocks producers at capacity. mangos (nanomsg) defines socket buffer limits with configurable send/receive high-water marks — exceeding the mark triggers the socket's overflow policy (block or drop). The broker's correctness depends on the overflow policy being a design decision, not an OOM surprise.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — machine-learning: robustmq/robustmq; lang:go: tomarrell/miniqueue, nanomsg/mangos)

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Dual-Speed Governance | complement | The overflow policy is often governed at slow speed (configuration, admin decision) while the buffer operates at fast speed (runtime data flow) |

## Discovery Context

Identified through bottom-up analysis of the 112-repo OCP scraper corpus during the triad run (2026-03-03). The pattern appeared independently in caching libraries (BigCache), message transport (libatbus), and observability ingestion pipelines (Pyroscope, HyperDX). In each case, the system explicitly bounds resource consumption and treats the overflow condition as a policy choice rather than an error.

## Falsification Conditions

- If the "overflow policy" is always the same default (e.g., always evict oldest) with no variation, this may just be "how caches work" rather than a structural motif
- If the bounded buffer and its overflow policy can be cleanly separated into independent concerns with no coupling, the motif dissolves into two unrelated patterns
- If systems with unbounded buffers and no overflow policy achieve equivalent reliability, the bounded buffer is unnecessary — the motif is an artifact of resource scarcity, not structural design
