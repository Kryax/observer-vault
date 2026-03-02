# DRAFT -- Observer Commons Protocol: Federation & Discovery Specification

**Status:** DRAFT
**Version:** 0.1.0
**Date:** 2026-03-01
**Author:** Architecture Agent (Sub-Agent 2: Federation & Discovery)
**ISC Coverage:** ISC-Fed-1 through ISC-Fed-8, ISC-A-Fed-1, ISC-A-Fed-2

---

## 1. Purpose and Scope

This document specifies how Observer Commons vaults announce themselves, publish solution records, discover each other, and synchronize. It defines the federation layer -- the connective tissue between independent knowledge stores.

**In scope:** Vault identity, announcement, publish/subscribe, cross-vault query, network topology, selective sharing, conflict resolution, Codeberg/Forgejo integration, protocol evaluation.

**Out of scope:** Solution record schema (Agent 1), trust scoring and reputation (Agent 3), composition protocol (Agent 4). This specification assumes solution records arrive as JSON-LD documents with fields for problem, domains, validation, implementation, composability, and provenance.

---

## 2. Design Principles

These principles are non-negotiable constraints that govern every design decision in this specification.

1. **Surveyor Epistemology** -- Truth requires multiple independent measurement sources. The federation must support discovery of multiple independent solutions to the same problem, never collapsing to a single authoritative answer.

2. **Protocol First** -- Solve with infrastructure, not community. Federation must work between two strangers running compatible software, with zero social coordination required.

3. **Federated Governance** -- No central authority. Attention signals (stars, forks, citations) emerge from usage, not from any registry node granting status.

4. **Human Sovereignty** -- Vault operators retain complete control over what they share, what they consume, and who they federate with. No protocol mechanism may override operator intent.

5. **Vendor Independence** -- The protocol must not depend on any single platform. Codeberg/Forgejo is the reference implementation host, but the protocol must work on any compliant forge or standalone server.

6. **Incremental Value** -- Each protocol layer must deliver value independently. A vault running only local indexing must benefit. A vault federating with one peer must benefit more. Full mesh participation is the ceiling, not the floor.

---

## 3. Protocol Evaluation: What to Borrow, What to Build

**[ISC-Fed-8]**

### 3.1 ActivityPub

**What it offers:** Mature actor model (inbox/outbox), Follow/Accept subscription flow, server-to-server federation over HTTPS, W3C standard with wide adoption (Mastodon, Forgejo, Lemmy).

**What we borrow:**
- The **actor model** maps cleanly to vaults. Each vault is an actor with an inbox (receives queries, subscription requests) and an outbox (publishes solution records, announcements).
- The **Follow/Accept** pattern for vault-to-vault subscriptions. Vault A sends Follow to Vault B. Vault B responds with Accept (or Reject). Vault B then delivers new solution records to Vault A's inbox.
- **Activity vocabulary** for describing actions: Create (new solution), Update (revised solution), Announce (re-sharing a solution from another vault), Follow, Accept, Reject.

**What we do NOT borrow:**
- ActivityPub's social-graph assumptions (likes, boosts, replies) are noise for our use case. We use a minimal subset.
- ActivityPub's reliance on WebFinger for actor discovery is acceptable but not sufficient -- we layer additional discovery mechanisms on top.
- The full ActivityStreams vocabulary is unnecessarily large. We define a constrained vocabulary (Section 6).

**Verdict:** ActivityPub is our **primary federation substrate**. It gives us a battle-tested server-to-server protocol, aligns with Forgejo's federation work, and provides the inbox/outbox pattern we need.

### 3.2 AT Protocol (Bluesky)

**What it offers:** DID-based identity, signed data repositories, lexicon schemas for type safety, separation of identity from hosting.

**What we borrow:**
- The **DID concept** for vault identity (Section 4). DIDs decouple vault identity from hosting location, enabling vault migration without breaking federation links.
- The **lexicon approach** to schema definition -- typed, versioned method definitions. We adapt this as our method namespace (Section 7).

**What we do NOT borrow:**
- AT Protocol's relay/firehose architecture assumes a small number of large aggregators. This contradicts our no-central-authority principle.
- The PDS/Relay/AppView separation adds architectural complexity that is unjustified for our scale.
- AT Protocol's DID:plc method depends on a specific PLC server. We use DID:web instead.

**Verdict:** Borrow the **identity model** (DIDs) and **schema discipline** (lexicons). Reject the infrastructure topology.

### 3.3 IPFS / libp2p

**What it offers:** Content-addressed storage (CIDs), peer discovery via DHT, cryptographic content verification, decentralized distribution.

**What we borrow:**
- **Content addressing for solution records.** Each solution record gets a content hash (CID). This enables deduplication, integrity verification, and location-independent references. When Vault A cites a solution from Vault B, the CID reference remains valid even if Vault B moves or goes offline and Vault C has a cached copy.
- **The principle of content-addressable identifiers** for immutable references to specific versions of solution records.

**What we do NOT borrow:**
- The full IPFS stack (DHT, Bitswap, libp2p transport) is heavyweight for our use case. Most vaults will be small operations, not always-on IPFS nodes.
- IPFS's "everything is content-addressed" model doesn't fit mutable vault metadata (capabilities, subscription lists).

**Verdict:** Borrow **content addressing for solution records** as an integrity and deduplication mechanism. Use CID-style hashes as record identifiers. Do NOT require IPFS infrastructure.

### 3.4 JSON-RPC 2.0

**What it offers:** Simple, well-specified RPC protocol. Request/response with typed errors. Batch support.

**What we borrow:**
- **Cross-vault query protocol** (Section 7) uses JSON-RPC 2.0 over HTTPS as the query transport. It is simple, well-understood, and has implementations in every language.
- Error code conventions for structured error handling.

**What we do NOT borrow:**
- JSON-RPC is transport-agnostic but says nothing about discovery or subscription. It handles the query path only.

**Verdict:** JSON-RPC 2.0 is our **query transport**. ActivityPub handles subscription and push; JSON-RPC handles pull/query.

### 3.5 ForgeFed (Forge Federation)

**What it offers:** ActivityPub extensions for software forges. Already implemented in Forgejo. Repository actors, issue federation, cross-forge collaboration.

**What we borrow:**
- **Alignment with Forgejo's federation model.** Since Codeberg runs Forgejo, and Forgejo implements ForgeFed, our vault actors should be compatible with ForgeFed's actor model where possible. This means a vault's federation endpoint can coexist on the same Forgejo instance that hosts its git repository.
- **The Repository actor type** as a reference for our Vault actor type.

**What we do NOT borrow:**
- ForgeFed's ticket/patch/merge-request vocabulary is irrelevant to solution records.
- ForgeFed is still maturing; we track it but do not depend on its stability.

**Verdict:** **Align** with ForgeFed where possible (actor types, ActivityPub profile). Do not depend on ForgeFed-specific features.

### 3.6 RSS/Atom

**What it offers:** The simplest possible publish/subscribe model. XML feeds, polling-based, universally supported.

**What we borrow:**
- **The conceptual model.** At its simplest, a vault's solution record feed IS an Atom feed. Phase 1 (Section 10) implements exactly this: a static Atom/JSON Feed file in a git repository that other vaults (or humans, or feed readers) can poll.
- **JSON Feed** (jsonfeed.org) as a more modern alternative to Atom XML.

**What we do NOT borrow:**
- Atom/RSS lacks any concept of identity, subscription management, or query. It is Phase 1 only; federation layers build on top.

**Verdict:** **Phase 1 foundation.** JSON Feed for solution record publication. ActivityPub federation layers on top in Phase 2+.

### 3.7 Summary Matrix

| Protocol     | Borrow                              | Reject                          | Phase |
|-------------|-------------------------------------|---------------------------------|-------|
| ActivityPub  | Actor model, Follow/Accept, inbox/outbox | Social vocabulary, full AS2   | 2-3   |
| AT Protocol  | DIDs, lexicon-style schemas         | Relay topology, DID:plc        | 2+    |
| IPFS         | Content addressing (CIDs)           | Full IPFS stack, DHT           | 2+    |
| JSON-RPC 2.0 | Query transport                    | (nothing -- it is minimal)     | 2     |
| ForgeFed     | Actor alignment, Forgejo compat     | Ticket/patch vocabulary        | 2-3   |
| RSS/JSON Feed| Static feed publication             | (nothing -- it is Phase 1)     | 1     |

---

## 4. Vault Identity

**[ISC-Fed-1 partial, ISC-Fed-8 partial]**

### 4.1 The Identity Question

**Should vault identity use DIDs, domain names, or something else?**

Answer: **DID:web as primary, with domain name as the human-readable handle.**

Rationale:
- `did:web` resolves to a well-known HTTPS URL, making it simple to implement (host a JSON file) while providing the DID framework benefits (cryptographic verification, standard format).
- Domain names serve as human-readable identifiers (like AT Protocol's handle system) but are NOT the canonical identity. A vault that migrates from `commons.example.org` to `vault.example.org` updates its handle but retains its DID history.
- `did:web` does depend on DNS, which introduces a centralization vector. This is an acceptable trade-off for Phase 2. Phase 3+ may introduce `did:key` or `did:plc` alternatives for vaults that want stronger decentralization guarantees.

### 4.2 Vault Identity Document

Each vault publishes a DID document at its well-known URL:

```
https://commons.example.org/.well-known/did.json
```

Minimal vault identity document:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/multikey/v1"
  ],
  "id": "did:web:commons.example.org",
  "alsoKnownAs": [
    "https://codeberg.org/observer-vault/commons"
  ],
  "verificationMethod": [
    {
      "id": "did:web:commons.example.org#key-1",
      "type": "Multikey",
      "controller": "did:web:commons.example.org",
      "publicKeyMultibase": "z6Mkf5..."
    }
  ],
  "service": [
    {
      "id": "did:web:commons.example.org#commons-federation",
      "type": "ObserverCommonsFederation",
      "serviceEndpoint": "https://commons.example.org/api/federation"
    },
    {
      "id": "did:web:commons.example.org#commons-feed",
      "type": "ObserverCommonsFeed",
      "serviceEndpoint": "https://commons.example.org/feed.json"
    }
  ]
}
```

### 4.3 Vault Identity for Codeberg-Hosted Vaults

Vaults hosted on Codeberg without a custom domain use a path-based DID:

```
did:web:codeberg.org:observer-vault:commons
```

This resolves to:
```
https://codeberg.org/observer-vault/commons/.well-known/did.json
```

Which can be served via Codeberg Pages or as a raw file in the repository.

### 4.4 Identity Without a Server

For vaults that are purely local (Obsidian on a laptop, no web presence), identity is deferred. The vault operates in **local-only mode** until the operator chooses to federate, at which point they provision an identity. This satisfies ISC-A-Fed-2 (no big-bang deployment).

---

## 5. Vault Announcement

**[ISC-Fed-1]**

### 5.1 Announcement Mechanism

A vault announces its existence and capabilities through a **Vault Profile** document, published at a well-known location and discoverable through multiple channels.

### 5.2 Vault Profile Schema

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://observer-commons.org/ns/v1"
  ],
  "type": "Service",
  "id": "did:web:commons.example.org",
  "name": "Example Observatory",
  "summary": "Solutions for distributed systems and API design patterns",
  "url": "https://commons.example.org",
  "inbox": "https://commons.example.org/api/federation/inbox",
  "outbox": "https://commons.example.org/api/federation/outbox",
  "published": "2026-01-15T00:00:00Z",
  "updated": "2026-03-01T12:00:00Z",
  "oc:protocolVersion": "0.1.0",
  "oc:capabilities": {
    "query": true,
    "subscribe": true,
    "fullText": false,
    "maxResults": 100
  },
  "oc:domains": [
    "distributed-systems",
    "api-design",
    "infrastructure"
  ],
  "oc:recordCount": 47,
  "oc:visibility": "public",
  "oc:forgeRepository": "https://codeberg.org/observer-vault/commons"
}
```

Key fields:
- **type: Service** -- ActivityPub actor type for automated services (not Person).
- **oc:capabilities** -- Machine-readable declaration of what this vault supports. Enables progressive protocol adoption.
- **oc:domains** -- High-level problem domains this vault covers. Enables domain-based discovery.
- **oc:visibility** -- Whether this vault's profile and feed are publicly listed.
- **oc:forgeRepository** -- Link to the backing Codeberg/Forgejo repository.

### 5.3 Discovery Channels

A vault can be discovered through any of these mechanisms (layered, not exclusive):

| Channel | Mechanism | Phase |
|---------|-----------|-------|
| **Direct URL** | Operator shares vault URL manually | 1 |
| **Git repository** | `commons-profile.json` in repo root | 1 |
| **JSON Feed** | Feed includes vault profile in metadata | 1 |
| **WebFinger** | `/.well-known/webfinger` lookup on domain | 2 |
| **Forge search** | Search Codeberg/Forgejo for `observer-commons` topic | 1 |
| **Peer announcement** | Vault A tells Vault B about Vault C via Announce activity | 2 |
| **Registry feed** | Curated list of known vaults (see Section 5.4) | 1 |

### 5.4 Bootstrap Registry (Non-Authoritative)

**The bootstrap problem:** How does a new vault find its first peers?

Solution: One or more **non-authoritative registry feeds** -- simple JSON files listing known vaults. These are NOT central authorities. They are curated lists, like browser bookmark files or OPML subscription lists. Anyone can publish one.

```json
{
  "oc:registryVersion": "0.1.0",
  "oc:description": "Observer Commons known vaults - community maintained",
  "oc:maintainer": "did:web:codeberg.org:observer-commons:registry",
  "oc:updated": "2026-03-01T00:00:00Z",
  "oc:vaults": [
    {
      "id": "did:web:commons.example.org",
      "name": "Example Observatory",
      "profileUrl": "https://commons.example.org/commons-profile.json",
      "domains": ["distributed-systems", "api-design"],
      "addedDate": "2026-01-15"
    }
  ]
}
```

The reference registry lives in a Codeberg repository. Any vault can fork it, add entries, and publish their own. This is the "RSS of vaults" -- a subscription list, not a gatekeeper.

**[ISC-A-Fed-1 satisfied]:** No single authority controls the registry. Multiple registries can coexist. Vaults can discover peers through any channel.

---

## 6. Publish/Subscribe Model

**[ISC-Fed-2]**

### 6.1 Publication: How Solution Records Are Published

Solution records are published through two complementary mechanisms:

#### 6.1.1 Phase 1: Static Feed (Pull-Based)

The vault publishes a **JSON Feed** (jsonfeed.org format) containing solution record summaries. This is a static file regenerated when records change, served from a git repository or static host.

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Example Observatory - Solution Records",
  "home_page_url": "https://commons.example.org",
  "feed_url": "https://commons.example.org/feed.json",
  "description": "Validated solutions from Example Observatory",
  "_oc": {
    "protocolVersion": "0.1.0",
    "vaultId": "did:web:commons.example.org"
  },
  "items": [
    {
      "id": "oc:record:bafkreihdwdcef...",
      "url": "https://commons.example.org/records/api-rate-limiting.json",
      "title": "API Rate Limiting with Token Bucket",
      "summary": "Token bucket algorithm for API rate limiting with adaptive backoff",
      "date_published": "2026-02-15T10:00:00Z",
      "date_modified": "2026-02-20T14:30:00Z",
      "tags": ["api-design", "rate-limiting", "infrastructure"],
      "_oc": {
        "recordCid": "bafkreihdwdcef...",
        "problemHash": "sha256:a1b2c3...",
        "domains": ["api-design", "infrastructure"],
        "validationStatus": "canonical"
      }
    }
  ]
}
```

Subscribers poll this feed at their chosen interval. Standard HTTP caching (ETag, Last-Modified) minimizes bandwidth.

**This works today**, with zero server infrastructure. A Codeberg Pages site or raw git file is sufficient.

#### 6.1.2 Phase 2: ActivityPub Push (Push-Based)

When a vault publishes a new solution record, it sends a **Create** activity to all followers' inboxes:

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://observer-commons.org/ns/v1"
  ],
  "type": "Create",
  "actor": "did:web:commons.example.org",
  "published": "2026-02-15T10:00:00Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["did:web:commons.example.org/followers"],
  "object": {
    "type": "oc:SolutionRecord",
    "id": "oc:record:bafkreihdwdcef...",
    "oc:recordCid": "bafkreihdwdcef...",
    "oc:problemHash": "sha256:a1b2c3...",
    "name": "API Rate Limiting with Token Bucket",
    "summary": "Token bucket algorithm for API rate limiting with adaptive backoff",
    "oc:domains": ["api-design", "infrastructure"],
    "url": "https://commons.example.org/records/api-rate-limiting.json"
  }
}
```

For updates to existing records, the vault sends an **Update** activity with the revised record and a new CID.

### 6.2 Subscription: How Vaults Subscribe

#### 6.2.1 Phase 1: Manual Feed Addition

Vault operator adds a feed URL to their local configuration. The vault periodically polls the feed. No handshake required. This is RSS-level simplicity.

```yaml
# Local vault federation config
subscriptions:
  - feed: "https://commons.example.org/feed.json"
    domains: ["api-design"]  # Optional: filter by domain
    poll_interval: 3600       # Seconds
```

#### 6.2.2 Phase 2: Follow/Accept Handshake

Vault A sends a Follow activity to Vault B:

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Follow",
  "actor": "did:web:vault-a.example.org",
  "object": "did:web:commons.example.org",
  "oc:domainFilter": ["api-design", "infrastructure"]
}
```

Vault B's operator reviews (or auto-accepts based on policy) and responds:

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Accept",
  "actor": "did:web:commons.example.org",
  "object": {
    "type": "Follow",
    "actor": "did:web:vault-a.example.org"
  }
}
```

After acceptance, Vault B pushes new solution records matching the domain filter to Vault A's inbox.

The `oc:domainFilter` extension enables **selective subscription** -- a vault can subscribe to only the domains it cares about, reducing noise.

### 6.3 Visibility Levels

**[ISC-Fed-5 partial]**

Every solution record has a visibility field:

| Visibility | Behavior |
|-----------|----------|
| `public` | Included in feed, queryable by any vault, listed in indexes |
| `unlisted` | Not in feed, but queryable if you know the CID/URL |
| `followers` | Delivered only to followed vaults, not in public feed |
| `private` | Never federated, local vault only |

Vault-level default visibility is set in the vault profile. Record-level visibility overrides the default.

---

## 7. Cross-Vault Query Protocol

**[ISC-Fed-3]**

### 7.1 Transport

Queries use **JSON-RPC 2.0 over HTTPS**. The endpoint is declared in the vault profile under the `ObserverCommonsFederation` service.

### 7.2 Method Namespace

All methods are namespaced under `oc.` to avoid collisions:

```
oc.query.search       -- Full-text/semantic search
oc.query.byProblem    -- Find solutions to a specific problem
oc.query.byDomain     -- List solutions in a domain
oc.query.byCid        -- Retrieve a specific record by CID
oc.vault.profile      -- Get vault profile
oc.vault.capabilities -- Get vault capabilities
oc.vault.stats        -- Get vault statistics
```

### 7.3 Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "oc.query.byDomain",
  "params": {
    "domain": "api-design",
    "filter": {
      "validationStatus": ["canonical", "draft"],
      "publishedAfter": "2026-01-01T00:00:00Z"
    },
    "pagination": {
      "cursor": null,
      "limit": 20
    },
    "requestor": "did:web:vault-a.example.org"
  },
  "id": "req-2026-03-01-001"
}
```

### 7.4 Response Format

```json
{
  "jsonrpc": "2.0",
  "result": {
    "records": [
      {
        "cid": "bafkreihdwdcef...",
        "title": "API Rate Limiting with Token Bucket",
        "summary": "Token bucket algorithm...",
        "domains": ["api-design", "infrastructure"],
        "problemHash": "sha256:a1b2c3...",
        "validationStatus": "canonical",
        "published": "2026-02-15T10:00:00Z",
        "modified": "2026-02-20T14:30:00Z",
        "url": "https://commons.example.org/records/api-rate-limiting.json",
        "vault": {
          "id": "did:web:commons.example.org",
          "name": "Example Observatory"
        }
      }
    ],
    "pagination": {
      "cursor": "eyJvZmZzZXQiOjIwfQ==",
      "hasMore": true,
      "totalEstimate": 47
    },
    "meta": {
      "queryTime": 42,
      "protocolVersion": "0.1.0"
    }
  },
  "id": "req-2026-03-01-001"
}
```

### 7.5 Pagination

Cursor-based pagination. The cursor is an opaque string returned by the server. Clients pass it back to get the next page. This avoids the offset-drift problems of page-number pagination.

- Default page size: 20
- Maximum page size: 100 (configurable per vault)
- Cursor expiration: implementation-defined, minimum 1 hour

### 7.6 Filtering

Queries support these filter fields:

| Filter | Type | Description |
|--------|------|-------------|
| `domain` | string | Primary domain match |
| `domains` | string[] | Any-of domain match |
| `validationStatus` | string[] | Filter by status |
| `publishedAfter` | ISO 8601 | Temporal lower bound |
| `publishedBefore` | ISO 8601 | Temporal upper bound |
| `problemHash` | string | Exact problem match |
| `textQuery` | string | Full-text search (if vault supports it) |

### 7.7 Error Codes

Standard JSON-RPC error codes plus Observer Commons extensions:

| Code | Meaning |
|------|---------|
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32001 | Rate limited |
| -32002 | Unauthorized (vault not in allow-list) |
| -32003 | Domain not served (vault does not cover requested domain) |
| -32004 | Query too broad (refine filters) |

### 7.8 Rate Limiting

Vaults MAY implement rate limiting. When rate-limited, the response includes:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Rate limited",
    "data": {
      "retryAfter": 60,
      "limit": 100,
      "window": 3600
    }
  },
  "id": "req-2026-03-01-001"
}
```

---

## 8. Network Topology

**[ISC-Fed-4]**

### 8.1 Topology Comparison

| Topology | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Flat mesh** | Maximum decentralization, no single point of failure, each vault is equal | O(n^2) connection scaling, discovery is hard without a starting point, high overhead for small vaults | Ideal target, impractical at early scale |
| **Hub-and-spoke** | Simple discovery (query the hub), low overhead for leaf vaults | Central hub is a single point of failure and control, violates ISC-A-Fed-1 | Rejected -- violates no-central-authority |
| **Hierarchical** | Manageable scaling, domain-based clustering, local queries stay local | Implies authority hierarchy, who decides the hierarchy? | Partially useful for domain clustering |
| **Gossip/epidemic** | Resilient, self-healing, no coordination needed | Convergence time unpredictable, bandwidth overhead, complexity | Useful for peer announcement only |
| **Small-world** | Real-world networks are small-world naturally, short path lengths | Requires deliberate construction or emerges slowly | Likely emergent outcome, not designed |

### 8.2 Recommended Topology: Federated Mesh with Bootstrap Registries

The Observer Commons uses a **federated mesh** topology:

- Each vault connects directly to the vaults it subscribes to. No intermediary.
- Bootstrap registries (Section 5.4) provide starting points for discovery. These are NOT hubs -- they are static lists, like DNS root hints.
- Peer announcement (gossip) enables organic discovery: when Vault A learns about Vault C from Vault B, it can connect directly.
- Domain clustering emerges naturally: vaults covering similar domains will tend to federate with each other.

```
  [Registry A]     [Registry B]       (Non-authoritative bootstrap lists)
       |                |
       v                v
  +--------+      +--------+
  | Vault A |<---->| Vault B |        (Direct peer connections)
  +--------+      +--------+
       ^               ^
       |               |
       v               v
  +--------+      +--------+
  | Vault C |<---->| Vault D |        (Vaults discover each other
  +--------+      +--------+         via registries, peers, or direct URL)
       ^
       |
  +--------+
  | Vault E |                         (Vault E only connects to Vault C;
  +--------+                          partial participation is fine)
```

This topology:
- Satisfies **ISC-A-Fed-1**: No central authority. Multiple registries, direct connections.
- Satisfies **ISC-A-Fed-2**: A vault federating with one peer is a valid deployment.
- Scales naturally: highly-connected vaults emerge through attention, not appointment.

### 8.3 Connection Lifecycle

1. **Bootstrap**: New vault consults a registry feed (or receives a direct URL from its operator).
2. **Discovery**: Vault fetches the peer's profile document. Validates protocol version compatibility.
3. **Subscription**: Vault subscribes (Phase 1: adds feed URL; Phase 2: sends Follow).
4. **Active**: Vault polls feed or receives pushed activities. Queries as needed.
5. **Dormant**: If a peer is unreachable for a configurable period (default: 7 days), the subscription enters dormant state. Polling frequency decreases.
6. **Disconnection**: Operator removes subscription, or sends Undo(Follow) in Phase 2.

---

## 9. Selective Sharing

**[ISC-Fed-5]**

### 9.1 Sharing Controls

Vault operators have fine-grained control over what they share:

#### 9.1.1 Vault-Level Controls

```yaml
# Vault federation policy
federation:
  visibility: public          # public | unlisted | private
  allowList: []               # DIDs of vaults allowed to query (empty = all)
  denyList: []                # DIDs of vaults blocked from querying
  autoAcceptFollows: false    # Require manual approval for followers
  defaultRecordVisibility: public
  publishDomains:             # Which domains to include in public feed
    - api-design
    - infrastructure
  privateDomains:             # Domains never federated
    - internal-ops
```

#### 9.1.2 Record-Level Controls

Each solution record can override the vault default:

```json
{
  "oc:visibility": "followers",
  "oc:shareWith": ["did:web:trusted-vault.example.org"]
}
```

#### 9.1.3 Query Access Control

When a vault receives a query:

1. Check if requestor DID is in deny list -- if so, return error -32002.
2. Check if allow list is non-empty and requestor is not in it -- if so, return error -32002.
3. Filter results to only include records visible to the requestor.
4. Return filtered results.

This is a simple ACL model. It is not cryptographic access control (that could be a Phase 4+ enhancement with encrypted records and key distribution).

### 9.2 Private Vaults

A vault with `visibility: private` does NOT publish a public feed, does NOT accept Follow requests from unknown vaults, and only responds to queries from its allow-list. It can still subscribe to and query other vaults. This is the "consumer-only" mode.

---

## 10. Content Addressing for Solution Records

### 10.1 Record Addressing: Content-Addressed with Location Fallback

**Should solution records be content-addressed (IPFS-style) or location-addressed (URL-style)?**

Answer: **Both.** Content addressing for identity and integrity. Location addressing for retrieval.

Each solution record has:
- A **CID** (Content Identifier) computed from a canonical serialization of the record's content fields. This is the record's immutable identifier for a specific version.
- A **URL** where the full record can be retrieved. This is mutable -- the vault can move.

The CID is computed as:
1. Canonicalize the JSON-LD record (JSON Canonicalization Scheme, RFC 8785).
2. Hash with SHA-256.
3. Encode as a CIDv1 with raw codec and base32 multibase.

This gives us IPFS-compatible CIDs without requiring IPFS infrastructure. If a vault chooses to pin records to IPFS, the CIDs will match.

### 10.2 Version History

When a solution record is updated, a new CID is generated. The record maintains a `previousVersion` link:

```json
{
  "oc:cid": "bafkreinew...",
  "oc:previousVersion": "bafkreiold...",
  "oc:versionNumber": 2
}
```

This creates a hash-linked version chain, similar to git commits.

---

## 11. Conflict Resolution

**[ISC-Fed-6]**

### 11.1 The Problem

Multiple vaults may publish solutions to the same problem. This is not a bug -- it is the fundamental design. Surveyor epistemology demands multiple independent measurements.

"Conflict" in the Observer Commons does not mean "error to resolve." It means "multiple perspectives to present."

### 11.2 Problem Identity

Solutions are linked to problems via a **problem hash** -- a content hash of a normalized problem statement. Two solutions with the same problem hash claim to solve the same problem.

Problem hash computation:
1. Normalize the problem statement (lowercase, remove articles, stem words -- exact algorithm TBD in the schema spec).
2. Hash with SHA-256.
3. This is intentionally fuzzy-matchable at the human layer -- exact matching is a floor, not a ceiling.

### 11.3 Conflict Resolution Strategy: Present, Don't Resolve

When a vault discovers multiple solutions to the same problem (same problem hash from different vaults), it does NOT pick a winner. Instead:

1. **Aggregate**: Collect all known solutions to the problem.
2. **Present**: Display them to the human with their provenance, trust signals, and validation status.
3. **Signal**: Show attention metrics (citations, adoption count, validation confirmations from other vaults).
4. **Defer**: The human decides which solution to adopt, fork, or synthesize.

This is the surveyor epistemology in action: multiple measurements, human judgment.

### 11.4 Attention Signals (Not Authority)

Solutions accumulate attention signals through federation:

| Signal | Mechanism | Weight |
|--------|-----------|--------|
| **Citation** | Another solution record references this one | High |
| **Adoption** | A vault marks a record as "adopted" in their local index | High |
| **Fork** | A vault creates a derived solution (with provenance link) | Medium |
| **Star** | A vault operator explicitly marks a solution (lightweight) | Low |
| **Age** | Time since publication, with sustained citations | Context |

These signals are descriptive, not prescriptive. They help humans evaluate; they do not automate decisions.

### 11.5 Competing Solutions from the Same Vault

If a single vault has two solutions to the same problem, the vault's governance process (promotion state machine) determines which is canonical. The federation layer simply publishes whatever the vault declares.

---

## 12. Codeberg/Forgejo as Federation Nodes

**[ISC-Fed-7]**

### 12.1 Architecture

Each vault's backing data lives in a Codeberg (Forgejo) git repository. The repository serves as both:
- **Storage**: Solution records as JSON-LD files in the repo.
- **Federation endpoint**: Via Codeberg Pages (static hosting) and/or Forgejo's emerging ActivityPub federation.

### 12.2 Repository Structure for Federation

```
observer-commons-vault/
  commons-profile.json          # Vault profile (Section 5.2)
  feed.json                     # JSON Feed of solution records (Section 6.1.1)
  .well-known/
    did.json                    # DID document (Section 4.2)
  records/
    api-rate-limiting.json      # Individual solution records
    cache-invalidation.json
    ...
  registry/
    known-vaults.json           # Optional: this vault's known peer list
```

### 12.3 How Forgejo Serves Federation

**Phase 1 (Static, Today):**
- `commons-profile.json` and `feed.json` are static files served via Codeberg Pages or raw git URLs.
- Discovery via Codeberg search: repositories tagged with `observer-commons` topic.
- No server-side logic required. A CI action (Forgejo Actions) regenerates `feed.json` when records change.

**Phase 2 (Forgejo Federation):**
- Forgejo is implementing ActivityPub federation (ForgeFed). When mature, vault repositories become ActivityPub actors.
- Follow/Accept between Forgejo instances enables push-based subscription.
- The vault profile becomes the Forgejo repository's ActivityPub actor profile.

**Phase 3 (Hybrid):**
- Vaults with custom domains run a lightweight federation server (could be a simple Node.js/Python service, or a Forgejo instance).
- Vaults on Codeberg continue using Forgejo's built-in federation.
- Both paths are interoperable because they speak the same ActivityPub subset.

### 12.4 Why NOT GitHub-Dependent

The protocol is explicitly designed to work with Forgejo/Codeberg because:

1. **Forgejo is open source and self-hostable.** Any organization can run their own instance. GitHub cannot be self-hosted.
2. **Forgejo is implementing federation.** GitHub is not. Federation is a protocol requirement.
3. **Codeberg is community-governed.** No corporate ownership that could change terms.
4. **Git is the transport, not the forge.** The protocol works with any git host. Forgejo/Codeberg is the reference implementation, not a dependency.

A vault hosted on a private Forgejo instance, on Codeberg, on Gitea, or on a bare git server with a static file host all work. The protocol tests against Codeberg as the reference environment.

### 12.5 Forgejo Actions for Feed Generation

A minimal Forgejo Actions workflow to regenerate the feed when records change:

```yaml
name: Regenerate Commons Feed
on:
  push:
    paths:
      - 'records/**'

jobs:
  build-feed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate feed.json
        run: |
          # Simple script to aggregate records into JSON Feed
          # This is the minimum viable federation tooling
          node scripts/generate-feed.js
      - name: Commit and push
        run: |
          git config user.name "Commons Bot"
          git config user.email "bot@example.org"
          git add feed.json
          git diff --cached --quiet || git commit -m "Regenerate solution feed"
          git push
```

---

## 13. Vault Downtime and Record Replication

### 13.1 The Downtime Question

**How do you handle vault downtime -- is there record replication?**

Answer: **Eventual consistency through caching and optional pinning, not mandatory replication.**

### 13.2 Strategy

1. **Subscriber caching**: When a vault polls a feed or receives a pushed record, it caches the record locally. If the source vault goes offline, subscribers still have their cached copies.

2. **CID-based verification**: Because records are content-addressed, a cached copy from any source is verifiable. If Vault A has a copy of a record from Vault B, and Vault B goes offline, Vault A can still serve that record (with provenance indicating the original source).

3. **Optional pinning**: Vaults can choose to pin (replicate) records they consider important. This is voluntary and operator-controlled.

4. **No mandatory replication**: The protocol does NOT require vaults to replicate each other's records. This would create storage obligations and governance complexity.

5. **Git as backup**: Because records live in git repositories, standard git mirroring provides a natural replication mechanism. `git clone --mirror` is the simplest disaster recovery.

### 13.3 Stale Record Handling

When a source vault is unreachable:
- Cached records are marked with `oc:lastVerified` timestamp.
- After a configurable staleness threshold (default: 30 days), cached records are flagged as `stale` in query results.
- The human decides whether to trust stale records.

---

## 14. Minimum Viable Federation

### 14.1 Two Vaults Sharing Records

The absolute minimum federation is:

1. **Vault A** publishes `feed.json` to its Codeberg repository.
2. **Vault B** adds Vault A's feed URL to its local subscription config.
3. Vault B periodically fetches Vault A's feed and indexes the solution record summaries.
4. Vault B's operator can browse solutions from Vault A alongside their own.

This requires:
- Zero server infrastructure (both sides are static files + git).
- Zero coordination (Vault B does not need Vault A's permission to subscribe to a public feed).
- Zero custom software beyond a feed generator script and a feed reader.

This is Phase 1. It works today.

### 14.2 Incremental Enhancement Path

| Phase | Capability | Infrastructure Required |
|-------|-----------|----------------------|
| 1 | Static feed publication and polling | Git repo + static hosting |
| 2 | ActivityPub Follow/Accept + push delivery | Lightweight server or Forgejo federation |
| 2 | JSON-RPC query endpoint | Lightweight server |
| 2 | DID-based identity | Static file hosting |
| 3 | Content-addressed records with CIDs | CID computation library |
| 3 | Peer announcement (gossip) | ActivityPub infrastructure |
| 4 | Encrypted records for selective sharing | Cryptographic key management |
| 4 | IPFS pinning for resilience | IPFS node (optional) |

Each phase delivers value independently. **[ISC-A-Fed-2 satisfied.]**

---

## 15. Wire Protocol Summary

### 15.1 Phase 1: Static Federation

```
Vault A                           Vault B
  |                                 |
  |-- publishes feed.json --------->|  (git push, static hosting)
  |                                 |
  |                  polls feed.json|  (HTTP GET with If-None-Match)
  |<--------------------------------|
  |                                 |
  |  returns feed.json              |
  |-------------------------------->|
  |                                 |
  |                  indexes records|  (local processing)
  |                                 |
```

### 15.2 Phase 2: Active Federation

```
Vault A                           Vault B
  |                                 |
  |<------ Follow ------------------|  (ActivityPub S2S)
  |                                 |
  |------- Accept ----------------->|
  |                                 |
  |  (new record published)         |
  |------- Create(SolutionRecord) ->|  (ActivityPub S2S push)
  |                                 |
  |                                 |
  |<------ oc.query.byDomain ------|  (JSON-RPC 2.0 over HTTPS)
  |                                 |
  |------- results ---------------->|
  |                                 |
```

---

## 16. Pre-Mortem: What Could Go Wrong?

This section deliberately stress-tests the federation design.

### 16.1 Spam and Abuse

**Risk:** Bad actors publish low-quality or malicious solution records to pollute the federation.

**Mitigation:**
- Subscription is opt-in. You only see records from vaults you choose to follow.
- Allow/deny lists at the vault level.
- Trust scoring (out of scope for this spec, but the architecture supports it) enables quality filtering.
- Content-addressed records mean spam CIDs can be blocklisted across the federation.

**Residual risk:** Medium. The first vaults will be curated communities. Spam is a scaling problem, not a bootstrap problem.

### 16.2 Sybil Attacks

**Risk:** A bad actor creates many fake vaults to inflate attention signals.

**Mitigation:**
- Attention signals are weighted by vault reputation (defined in trust spec, not here).
- DID identity provides a foundation for reputation systems.
- Vault creation on Codeberg has natural friction (account creation, repository maintenance).

**Residual risk:** Low at early scale. Must be addressed before the network is large enough to be worth attacking.

### 16.3 Network Fragmentation

**Risk:** The federation splits into isolated clusters that never discover each other.

**Mitigation:**
- Bootstrap registries provide cross-cluster bridges.
- Peer announcement (gossip) in Phase 2 enables organic discovery.
- Domain overlap creates natural connections (vaults covering similar topics discover each other).

**Residual risk:** Low. The small initial size makes fragmentation unlikely.

### 16.4 Protocol Ossification

**Risk:** The protocol becomes too rigid to evolve, or incompatible versions fragment the network.

**Mitigation:**
- Protocol version is declared in the vault profile.
- Capabilities declaration allows vaults to advertise what they support.
- Semantic versioning: minor versions add optional features, major versions may break compatibility.
- Long deprecation windows for breaking changes.

**Residual risk:** Medium. All federation protocols struggle with versioning. Being small and early helps.

### 16.5 Forgejo Federation Instability

**Risk:** We build on Forgejo's ActivityPub federation, but it changes or is abandoned.

**Mitigation:**
- Phase 1 does not depend on Forgejo federation at all (static files only).
- The protocol uses standard ActivityPub, not Forgejo-specific extensions.
- If Forgejo federation stalls, vaults can run standalone federation servers.

**Residual risk:** Low, because of layered independence.

### 16.6 Complexity Creep

**Risk:** The protocol becomes too complex for small vault operators to implement.

**Mitigation:**
- Phase 1 is literally "publish a JSON file in a git repo."
- Reference implementations for each phase.
- The protocol is designed so a vault can participate at any layer.

**Residual risk:** Low for Phase 1-2. Must be vigilant as Phase 3+ features are added.

### 16.7 Supply Chain Attack via Records

**Risk:** Solution records contain implementation guidance. A compromised record could propagate bad advice.

**Mitigation:**
- Content addressing means records are immutable once published. A tampered record has a different CID.
- Provenance tracking links records to their source vault.
- Multiple independent solutions (surveyor epistemology) provide cross-validation.
- Human sovereignty: the operator evaluates, the protocol presents.

**Residual risk:** Medium. This is a fundamental challenge in any knowledge-sharing system.

---

## 17. Sovereignty Check: Does This Design Preserve Human Control?

| Aspect | Sovereignty Status | Notes |
|--------|-------------------|-------|
| **What to share** | PRESERVED | Vault operator sets visibility per-record and per-vault |
| **Who to federate with** | PRESERVED | Operator chooses subscriptions, allow/deny lists |
| **What to consume** | PRESERVED | Operator chooses which feeds to subscribe to, domain filters |
| **Which solutions to trust** | PRESERVED | Conflict resolution presents options, human decides |
| **Whether to participate** | PRESERVED | Local-only mode is valid. Federation is opt-in at every layer |
| **Where to host** | PRESERVED | Protocol works on any Forgejo, any static host, any domain |
| **Identity ownership** | PRESERVED | DID:web is self-hosted. Vault operator controls their identity |
| **Data portability** | PRESERVED | Git-based storage. Clone and move. CIDs travel with content |

**Verdict:** Human sovereignty is preserved at every decision point. No protocol mechanism can force a vault to share, consume, trust, or participate. The human always decides.

---

## 18. Simplicity Check: Is This the Simplest Version That Could Work?

### 18.1 What Is Phase 1?

Phase 1 is:
1. Publish a `feed.json` file in a git repository.
2. Add a `commons-profile.json` file describing the vault.
3. Subscribe to other vaults by adding their feed URLs to a local config.
4. Poll feeds and index records locally.

That is it. No servers. No ActivityPub. No DIDs. No CIDs. No JSON-RPC. Just JSON files in git repositories and a simple polling client.

### 18.2 What Could Be Simpler?

- We could skip the JSON Feed format and use plain JSON arrays. But JSON Feed is a well-understood standard with existing tooling. The marginal complexity is near zero.
- We could skip the vault profile. But without it, there is no machine-readable way to describe what a vault offers. One file is not complex.
- We could skip content addressing entirely. But then we have no way to reference specific record versions or verify integrity. CIDs can be deferred to Phase 2 without losing Phase 1 value.

### 18.3 What Was Explicitly Deferred?

| Feature | Deferred To | Reason |
|---------|------------|--------|
| ActivityPub push delivery | Phase 2 | Requires a server |
| DID identity | Phase 2 | Phase 1 uses plain URLs |
| JSON-RPC queries | Phase 2 | Phase 1 uses feed polling |
| Content-addressed CIDs | Phase 2/3 | Phase 1 uses URLs |
| Peer gossip | Phase 3 | Requires ActivityPub foundation |
| Encrypted sharing | Phase 4 | Requires key management |
| IPFS pinning | Phase 4 | Nice-to-have, not essential |

**Verdict:** Phase 1 is the simplest thing that could work -- JSON files in git. Each subsequent phase adds value without requiring adoption of all phases. This is incremental by design.

---

## 19. Open Questions for Resolution

These questions require input from other agents or from Adam:

1. **Problem hash normalization algorithm** -- The exact text normalization for computing problem hashes must be defined in the schema spec (Agent 1). This spec assumes it exists.

2. **Trust signal weighting** -- Section 11.4 lists attention signals but does not define weights. This is Agent 3's (Trust & Reputation) responsibility.

3. **Domain vocabulary** -- Is the list of domains (api-design, infrastructure, etc.) controlled or freeform? If controlled, who governs the vocabulary? Recommend: freeform with a curated "suggested domains" list.

4. **Feed polling interval norms** -- Should the protocol recommend a minimum poll interval to prevent abuse? Recommend: suggest 1 hour minimum, enforce nothing.

5. **Maximum record size** -- Should the protocol define a maximum size for solution records in the feed? Large records could be prohibitive for polling. Recommend: feed contains summaries (max 1KB), full records fetched by URL.

6. **Signature format** -- When we add cryptographic signatures (Phase 2+), which signature scheme? Ed25519 is the likely choice for simplicity and security.

7. **ActivityPub compliance level** -- Do we aim for full ActivityPub compliance (interop with Mastodon etc.) or a constrained subset? Recommend: constrained subset with full compliance as a non-goal.

---

## 20. Glossary

| Term | Definition |
|------|-----------|
| **Vault** | A curated knowledge store with governance. The fundamental unit of the Observer Commons federation. |
| **Solution Record** | A structured document describing a validated solution to a defined problem. |
| **CID** | Content Identifier. A cryptographic hash of a record's content, used as an immutable identifier. |
| **DID** | Decentralized Identifier. A self-sovereign identity for a vault, following W3C DID specification. |
| **Problem Hash** | A content hash of a normalized problem statement, used to link solutions to problems. |
| **Federation** | The protocol by which independent vaults discover each other and exchange solution records. |
| **Bootstrap Registry** | A non-authoritative list of known vaults, used for initial discovery. |
| **Attention Signal** | A metric indicating community interest in a solution (citations, adoptions, stars). |
| **Visibility** | The access level of a solution record or vault (public, unlisted, followers, private). |

---

## Appendix A: ISC Criteria Traceability

| Criterion | Section(s) | Status |
|-----------|-----------|--------|
| ISC-Fed-1: Vault announcement mechanism | 4, 5 | Satisfied |
| ISC-Fed-2: Publish/subscribe model | 6 | Satisfied |
| ISC-Fed-3: Cross-vault query protocol | 7 | Satisfied |
| ISC-Fed-4: Network topology recommendation | 8 | Satisfied |
| ISC-Fed-5: Selective sharing | 6.3, 9 | Satisfied |
| ISC-Fed-6: Conflict resolution | 11 | Satisfied |
| ISC-Fed-7: Codeberg/Forgejo as federation nodes | 12 | Satisfied |
| ISC-Fed-8: Existing protocol evaluation | 3 | Satisfied |
| ISC-A-Fed-1: No central authority | 5.4, 8.2 | Satisfied |
| ISC-A-Fed-2: No big-bang deployment | 14, 18 | Satisfied |

---

## Appendix B: Reference Implementation Roadmap

### Phase 1 Deliverables (Minimum Viable Federation)
1. `generate-feed.js` -- Script to aggregate solution records into JSON Feed
2. `commons-profile.json` -- Template vault profile
3. `poll-feeds.js` -- Script to fetch and index remote feeds
4. Forgejo Actions workflow for automated feed regeneration
5. Documentation: "How to publish your vault to the Observer Commons"

### Phase 2 Deliverables (Active Federation)
1. Federation server (lightweight HTTP service)
2. ActivityPub Follow/Accept handler
3. JSON-RPC query endpoint
4. DID document generation and hosting
5. Documentation: "How to run a federation endpoint"

### Phase 3 Deliverables (Full Federation)
1. CID computation and verification library
2. Peer announcement and gossip protocol
3. Record caching and staleness tracking
4. Multi-vault query aggregation
5. Documentation: "Operating a federation node at scale"

---

*This document is DRAFT. All designs, protocols, and specifications are subject to revision based on implementation experience and community feedback.*
