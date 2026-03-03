---
name: "Bounded Buffer With Overflow Policy"
tier: 1
status: provisional
confidence: 0.9
source: "triangulated"
domain_count: 7
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

### Instance 5: Audio Buffer Sizing in DAWs (Bottom-Up — Zrythm) [CANONICAL]
- **Domain:** Music Production / Audio Engineering
- **Expression:** Audio buffers in DAWs are THE canonical real-world bounded buffer with explicit overflow policy. Buffer size (256/512/1024/2048 samples) is a first-class configuration decision. Overflow policy: buffer underrun → audio glitch (audible artifact). The ENTIRE latency-vs-stability tradeoff in audio production IS the bounded buffer overflow policy — smaller buffer = lower latency = higher underrun risk; larger buffer = higher latency = more stability. This is a conscious, policy-governed design decision, not an error condition. Audio buffer sizing predates modern software engineering — digital audio has used bounded buffers since the 1980s.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — music-production: zrythm/zrythm 2.9k★)

### Instance 6: Bioinformatics Pipeline Channels (Bottom-Up — Nextflow, fastp)
- **Domain:** Bioinformatics / Computational Biology
- **Expression:** Nextflow channels between processes are bounded data queues with configurable backpressure. When a downstream process can't consume fast enough, the channel applies backpressure to the upstream process or spills to disk. This is essential — bioinformatics datasets (whole genomes, exome captures) can be 100GB+, and unbounded buffers would OOM. fastp uses thread-based I/O with bounded buffers between read/process/write stages. Buffer sizing determines throughput vs. memory tradeoff. The overflow policy (backpressure vs. buffer growth) is a deliberate configuration, not an accident.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — bioinformatics: nextflow-io/nextflow 3.3k★, opengene/fastp 2.3k★)

### Instance 7: Game Engine Event Queues (Bottom-Up — Bevy) [Secondary]
- **Domain:** Game Engine Architecture
- **Expression:** Bevy's ECS event queues are bounded with explicit lifetime policies — events persist for exactly 2 frames then are silently dropped. This IS a bounded buffer with overflow policy (overflow = silent drop after TTL), distinct from the "evict oldest" default seen in caching. Command buffers queue entity spawn/despawn operations during system execution, flushed at sync points. Note: this is a secondary architectural concern in game engines, not the defining one — unlike audio buffers in DAWs, which ARE the architecture.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — game-development: bevyengine/bevy 45k★)

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Dual-Speed Governance | complement | The overflow policy is often governed at slow speed (configuration, admin decision) while the buffer operates at fast speed (runtime data flow) |

## Discovery Context

**Bottom-up (2026-03-03, first triad run):** Identified across 112-repo OCP corpus in caching (BigCache), message transport (libatbus), observability (Pyroscope, HyperDX), and message queuing (RobustMQ, miniqueue, mangos).

**Bottom-up (2026-03-03, alien domain triad run):** Confirmed across 3 alien domains. Music production (Zrythm audio buffers — CANONICAL instance that predates software engineering), bioinformatics (Nextflow channels with backpressure, fastp I/O buffers), and game engines (Bevy event TTL — secondary instance).

**Triangulation confirmed:** Bottom-up from infrastructure + bottom-up from alien domains.

## Confidence Score Arithmetic

| Step | Event | Change | Running Total |
|------|-------|--------|---------------|
| 1 | Instance 1 (Caching) | Start at 0.1 | 0.1 |
| 2 | Instance 2 (Message Transport) | +0.1 | 0.2 |
| 3 | Instance 3 (Observability) | +0.1 | 0.3 |
| 4 | Instance 4 (Message Queuing) | +0.1 | 0.4 |
| 5 | Instance 5 (Music Production, alien, CANONICAL) | +0.1 | 0.5 |
| 6 | Instance 6 (Bioinformatics, alien) | +0.1 | 0.6 |
| 7 | Instance 7 (Game Engines, alien, secondary) | +0.1 | 0.7 |
| 8 | Triangulation confirmed (infra + alien) | +0.2 | 0.9 |

**Final: 0.9.**

## Falsification Conditions

- If the "overflow policy" is always the same default (e.g., always evict oldest) with no variation, this may just be "how caches work" rather than a structural motif
- If the bounded buffer and its overflow policy can be cleanly separated into independent concerns with no coupling, the motif dissolves into two unrelated patterns
- If systems with unbounded buffers and no overflow policy achieve equivalent reliability, the bounded buffer is unnecessary — the motif is an artifact of resource scarcity, not structural design
