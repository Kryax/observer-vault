# Sovereign Infrastructure Research

> Status: DRAFT | Date: 2026-03-29 | Author: Atlas (intern agent)

Research into self-hosted git forges, VPN/privacy layers, and distributed sovereign infrastructure for a Proxmox-based bare-metal environment with ZFS storage.

---

## 1. Git Hosting Options

### 1.1 Forgejo

**What it is:** Community-driven hard fork of Gitea, governed by Codeberg e.V. (German non-profit). Became a hard fork in early 2024, meaning codebases now actively diverge.

**License:** MIT for core. Entirely free/libre software stack -- developed, tested, and released exclusively on its own infrastructure (Codeberg). No copyright assignment required for contributions.

**Governance:** Non-profit (Codeberg e.V.) owns domain and trademark. No corporate board, no venture capital. Decisions made by community governance. This is the critical differentiator from Gitea.

**Resource usage:**
- RAM: ~170-200MB baseline, comparable to Gitea. Can run on a Raspberry Pi.
- CPU: Minimal. Single core adequate for solo/small team.
- Storage: SQLite default (lightweight), Postgres optional for scale.
- Runs as a single Go binary.

**Features (diverging from Gitea):**
- Forgejo Actions: Built-in CI/CD, GitHub Actions-compatible YAML syntax (not identical, but familiar). Self-hosted runners execute in Docker containers.
- Container registry (OCI-compliant): Docker images, Helm charts.
- Federation via ActivityPub: Experimental but active development. Currently supports federated "stars" across instances. User following in progress. NLnet-funded through 2025-2026.
- End-to-end browser tests, upgrade tests, accessibility checks -- Gitea lacks these.
- Proactive security disclosure to third parties before public release.
- Weblate for translations (vs Gitea's proprietary Crowdin).

**CI/CD:** Forgejo Actions with self-hosted runners. Security audit completed late 2024, fixes shipped 2025. Docker-in-Docker support for resource-constrained environments.

**Migration from GitHub:** Built-in migrator handles repos, issues, PRs, labels, releases, milestones. Also third-party scripts (GITHUB2FORGEJO) for bulk migration. Multiple documented successful migrations of 200+ projects.

**Backup:** SQLite file + bare git repos on disk. Trivially snapshotted with ZFS. Postgres if using that backend.

**Maintenance burden:** LOW. Single binary, minimal config. Upgrades are typically smooth. Active community support on Codeberg.

**UNCERTAINTY:** Federation is experimental and breaking changes are expected. The timeline for production-ready federation is unclear. Monthly progress reports are published.

**Recommendation for your setup:** STRONG FIT. Lightweight, sovereign governance, runs great on Proxmox VMs/LXC, ZFS-friendly backup story, CI/CD built in.

---

### 1.2 Gitea

**What it is:** Open-source git forge, originally a community project. Now controlled by Gitea Limited (for-profit company).

**The controversy (2022-present):**
- October 2022: Domain and trademark transferred to Gitea Ltd without community knowledge or approval.
- Community published open letter demanding restitution. Gitea Ltd refused and confirmed total control.
- A Technical Oversight Committee (3 elected seats) provides some democratic input, but Gitea Ltd owns domain, trademark, and final authority.
- Open Core model: proprietary enterprise features sold separately via CommitGo, Inc.
- 2024: Gitea now offers hosted service (CommitGo) and "Gitea Enterprise" alongside the community edition.
- Copyright assignment required for contributions. PRs from community have been blocked/charged for.

**License:** MIT for community edition, but the Open Core approach means premium features are proprietary.

**Resource usage:** Nearly identical to Forgejo (~170-200MB RAM, single binary Go app).

**Features:** Similar feature set to Forgejo (same ancestry), but:
- No federation work underway.
- No end-to-end or upgrade testing (only example browser test as of mid-2025).
- Security fixes have been delayed in favor of SOC2 audits for SaaS offering.
- Advance security notice restricted to paying customers.
- Uses Crowdin (proprietary) for translations.

**CI/CD:** Gitea Actions, similar to Forgejo Actions.

**Migration from GitHub:** Same built-in migrator (shared ancestry).

**ASSESSMENT:** Functionally similar to Forgejo but with governance concerns. For a sovereignty-focused setup, Forgejo is the better choice -- same features, non-profit governance, better security practices, active federation development. There is no compelling reason to choose Gitea over Forgejo in 2026.

---

### 1.3 Radicle

**What it is:** Peer-to-peer code collaboration protocol built on Git. Not a forge in the traditional sense -- it is a decentralized network protocol.

**Technical architecture (Heartwood release):**
- **Nodes:** Each participant runs a node identified by an Ed25519 public key (encoded as DID). Nodes act as both client and server simultaneously.
- **Gossip protocol:** Three message types:
  1. Node Announcements: broadcast Node IDs and addresses for peer discovery.
  2. Inventory Announcements: share repository inventories to build routing tables.
  3. Reference Announcements: propagate repository updates to interested peers.
  All messages are cryptographically signed with timestamps and nonces (DoS protection).
- **Transport:** Noise XK handshake pattern with Diffie-Hellman key exchange. Multiplexed connections allow concurrent Git fetches over a single connection.
- **Replication:** Actual data transfer uses Git's native protocol. Repositories are self-certifying -- verification requires no external input beyond the repository itself.
- **Repository identity:** Each repo gets a Repository ID (RID) derived deterministically from its identity document. Delegates sign all references. Threshold signatures (e.g., 2-of-3 delegates) determine canonical state.
- **Storage:** Git namespaces per peer, shared object database. No duplication of objects across peers seeding the same repo.
- **Collaborative Objects (COBs):** Issues, patches, and identities stored as Git objects using CRDT-like conflict resolution. Changes stored as commits in DAGs, replayed in deterministic causal order. Extensible via custom COBs (reverse domain notation namespacing).

**Code review:** COBs support "Patches" (their equivalent of PRs) with inline code review. Still described as "rudimentary" but actively developed. FOSDEM 2026 talk indicates continued investment.

**Maturity:**
- Heartwood (1.0) shipped. Protocol is specified and implemented.
- Real-world usage: Radicle team uses it for their own development.
- Still evolving. Missing features compared to a full forge (no project boards, no wiki, limited web UI).
- No built-in CI/CD, but demonstrated integration with GitHub Actions (push to both Radicle and GitHub, run CI on GitHub).

**Can it replace a forge?** NOT YET for most workflows. It excels at:
- Sovereign code hosting with no single point of control.
- Offline-first collaboration.
- Cryptographic identity and verification.

It lacks:
- Web UI polish (terminal-first).
- Built-in CI/CD.
- Rich project management (issues are basic).
- Easy onboarding for non-technical contributors.

**Can it coexist with a forge?** YES. Practical pattern: push to both Radicle and Forgejo/GitHub. Use Radicle as the sovereign canonical source. Mirror to forge for CI/CD and discoverability. Cron-based sync works today.

**Resource usage:** Lightweight. A Radicle node is a single Rust binary. Minimal CPU/RAM for a personal seed node.

**Backup:** Git repos on disk. ZFS snapshot-friendly.

**UNCERTAINTY:** Code review maturity is unclear. The protocol is solid but the user-facing tooling is still catching up. Federation between Radicle and traditional forges does not exist at protocol level.

**Recommendation for your setup:** COMPLEMENTARY. Run Forgejo as the primary forge, seed repos on Radicle for sovereign backup and peer-to-peer distribution. The two solve different problems.

---

### 1.4 Self-hosted GitLab CE

**What it is:** Full-featured DevOps platform. Community Edition is open-source (MIT). Enterprise Edition adds proprietary features.

**Resource requirements (the elephant in the room):**
- MINIMUM: 4 GB RAM + 2 CPU cores. Will boot but be sluggish.
- RECOMMENDED: 8 GB RAM + 4 CPU cores for a single user using CI/CD.
- OFFICIAL 1000-user spec: 16 GB RAM + 8 vCPUs.
- Memory-constrained mode: Can run at 2.5 GB RAM + 1 GB swap, but performance is "modest."
- Components: Sidekiq (background jobs), Gitaly (Git operations), PostgreSQL, Redis, Puma (web server), Workhorse -- many moving parts.

**Is it overkill for solo/small team?** YES. GitLab's architecture is designed for enterprise teams. For a solo developer:
- 80%+ of features will go unused.
- Resource consumption is 10-40x higher than Forgejo for equivalent git hosting.
- Maintenance burden is significantly higher (complex upgrades, many services).

**CE vs EE:**
- CE: Free, MIT-licensed. Covers git hosting, CI/CD, container registry, issue tracking, wiki.
- EE: Proprietary features (advanced CI, security scanning, compliance). Irrelevant for solo use.

**CI/CD:** GitLab CI is excellent and mature. Arguably the best self-hosted CI/CD available. If CI/CD complexity is the primary need, this is a point in GitLab's favor.

**Migration from GitHub:** Mature import tools. Well-documented.

**Backup:** `gitlab-backup` command. Multiple components to back up (DB, repos, uploads, config). ZFS snapshots help but gitlab-backup is still recommended for consistency.

**Maintenance burden:** HIGH. Ruby/Rails application with many services. Upgrades require following specific version paths. Database migrations can be slow.

**Recommendation for your setup:** OVERKILL. The CI/CD is good but Forgejo Actions covers the need at 1/40th the resource cost. Only consider if you specifically need GitLab CI features that Forgejo Actions cannot provide.

---

### 1.5 cgit + Email Patches

**What it is:** cgit is a read-only web frontend for Git repos (fast, C-based CGI). Combined with `git-send-email` for the kernel-style patch workflow.

**How it works:**
- cgit points at bare git repos on disk. No database -- just reads the filesystem.
- Contributors send patches via email (`git format-patch` + `git send-email`).
- Maintainer applies patches with `git am`.
- Access control via SSH keys + Unix users, or gitolite.

**Resource usage:** MINIMAL. cgit is a CGI binary -- effectively zero idle resource usage. Nginx/Caddy serves it. A Raspberry Pi can run it easily.

**Features:**
- Web browsing of repos, commits, diffs, trees, logs.
- No issues, no PRs, no CI/CD, no project management.
- No web-based code review.

**CI/CD:** None built in. Wire up with any external CI (Jenkins, Woodpecker, etc.) via git hooks.

**Migration from GitHub:** Manual. Clone repos, set up bare repos, configure cgit. No issue/PR migration path.

**Backup:** Bare git repos on disk. Trivial ZFS snapshots.

**Maintenance burden:** VERY LOW. Almost nothing to maintain once set up. cgit itself rarely needs updates.

**Viability for a small project ecosystem:** VIABLE but austere. Works well if:
- You are the sole developer or work with technically proficient collaborators.
- You do not need web-based code review.
- You are comfortable with email workflows.
- Discoverability and contributor onboarding are not priorities.

**UNCERTAINTY:** The email patch workflow is proven (Linux kernel uses it) but requires discipline and tooling comfort. Many developers find it unfamiliar.

**Recommendation for your setup:** INTERESTING BUT LIMITING. Could work as a minimal public-facing read-only mirror alongside Forgejo as the primary collaboration tool.

---

### 1.6 Soft Serve (Charm)

**What it is:** Terminal-based git server from Charm (the TUI framework people). Single Go binary.

**Features:**
- TUI accessible over SSH (browse repos, view code via terminal).
- Git over SSH, HTTP(s), and native Git protocol.
- Access control with 4 levels (no-access, read-only, read-write, admin).
- Server-side hooks (pre-receive, update, post-update, post-receive).
- Webhooks per repository.
- Git LFS support.
- SQLite backend (Postgres optional).
- Create repos on demand with `git push`.

**Resource usage:** VERY LOW. Single binary + SQLite. Comparable to cgit in footprint.

**What it lacks:**
- No web UI (TUI only -- SSH-accessible).
- No issues, PRs, or project management.
- No CI/CD.
- No code review workflow.

**Migration from GitHub:** Manual repo migration only. No issue/PR import.

**Backup:** SQLite + bare git repos. ZFS-friendly.

**Maintenance burden:** VERY LOW.

**Recommendation for your setup:** NICHE. Beautiful for a hacker aesthetic and SSH-first workflow. Not a replacement for a forge. Could serve as a lightweight internal git server for personal/private repos where you just need push/pull access with a nice terminal experience. Pair with Forgejo for anything collaborative.

---

### Comparative Summary

| Feature | Forgejo | Gitea | Radicle | GitLab CE | cgit+email | Soft Serve |
|---------|---------|-------|---------|-----------|------------|------------|
| RAM baseline | ~200MB | ~200MB | ~50-100MB | 4-8GB | ~10MB | ~30MB |
| CPU needs | 1 core | 1 core | 1 core | 2-4 cores | negligible | 1 core |
| CI/CD | Built-in (Actions) | Built-in (Actions) | None (external) | Built-in (excellent) | None | None |
| Container registry | Yes (OCI) | Yes (OCI) | No | Yes | No | No |
| Code review | Web PR review | Web PR review | COBs (basic) | Web MR review | Email patches | No |
| Issue tracking | Yes | Yes | COBs (basic) | Yes (rich) | No | No |
| Federation | ActivityPub (WIP) | No | Native (P2P) | No | No | No |
| GitHub migration | Built-in migrator | Built-in migrator | Manual | Built-in | Manual | Manual |
| Governance | Non-profit | For-profit (Gitea Ltd) | Open source | Open core | N/A | MIT |
| Backup complexity | Low | Low | Low | High | Very low | Very low |
| Maintenance burden | Low | Low | Low | High | Very low | Very low |

---

## 2. VPN / Privacy

### 2.1 Mullvad VPN

**Reputation (2025-2026):** Gold standard for privacy VPNs. Consistently top-rated by privacy advocates and technical reviewers. No breaches, no controversies. When Swedish police arrived with a warrant in April 2023, Mullvad had no user data to hand over -- concrete proof of their no-logs claims.

**WireGuard:** Mullvad is going WireGuard-only. OpenVPN support was retired on desktop (January 15, 2026). WireGuard is the sole protocol on mobile and will be on all platforms.

**Payment anonymity:**
- Cash (mailed to Sweden)
- Monero (best crypto privacy option)
- Bitcoin, Bitcoin Cash
- No email or personal info required. 16-digit account number generated anonymously.
- Also accepts: PayPal, bank transfer, credit card, Swish, various EU payment methods.

**Non-systemd Linux:** YES, works well.
- `wg-quick` is the standard approach: download Mullvad WireGuard config files, place in `/etc/wireguard/`, run `wg-quick up <config>`.
- No dependency on systemd. WireGuard is a kernel module + userspace tools. `wg-quick` uses standard networking tools.
- Kill switch can be configured via iptables/nftables rules in the WireGuard config `[Interface]` section (PostUp/PreDown).
- On CachyOS (Arch-based), WireGuard kernel module is built-in. `wireguard-tools` package provides `wg` and `wg-quick`.

**UNCERTAINTY:** Mullvad's server count has been reduced in some regions. Performance varies by exit node location. The non-systemd kill switch requires manual iptables configuration (not hard, but not automatic).

---

### 2.2 IVPN

**Comparison to Mullvad:**
- Also privacy-focused, no-logs, audited.
- **Key differentiator:** IVPN operates entirely self-hosted servers (no rented cloud infrastructure). This is a meaningful security advantage.
- WireGuard and OpenVPN supported.
- MultiHop routing (custom chains across countries).
- AntiTracker + Hardcore mode for granular ad/telemetry blocking.
- Anonymous payment: cash and Monero accepted.
- Slightly higher price than Mullvad.
- Smaller server network.

**When to choose IVPN over Mullvad:**
- If self-hosted server infrastructure matters to you (IVPN owns all their servers).
- If you want MultiHop with fine-grained country chaining.
- If you want built-in tracker blocking at the VPN level.

**When Mullvad wins:**
- Larger server network.
- Tailscale integration (see below).
- Simpler interface and philosophy.
- WireGuard-only focus means better optimization.

**UNCERTAINTY:** IVPN's server network is smaller, which can mean fewer options for low-latency connections depending on your geographic location.

---

### 2.3 Self-hosted WireGuard + Tailscale Coexistence

**Current state: Tailscale + Mullvad integration (official partnership).**

This is the recommended architecture:

```
[Your devices] --Tailscale mesh--> [Your Proxmox nodes]
                                   [Your other devices]
                  |
                  +--> [Mullvad exit nodes] --> [Public internet]
```

**How it works:**
- Tailscale provides the mesh overlay (device-to-device encrypted connectivity).
- Mullvad exit nodes are available as Tailscale exit nodes via an official add-on.
- Your Tailscale WireGuard key pair registers with Mullvad infrastructure.
- Traffic to your own devices stays on the Tailscale mesh (never touches Mullvad).
- Traffic to the public internet routes through Mullvad (privacy for external traffic).
- This is a SINGLE WireGuard interface -- no conflict between two WireGuard instances.

**Can raw WireGuard coexist with Tailscale?**
- Technically possible but prone to routing conflicts (both manipulate routing tables and WireGuard interfaces).
- The Tailscale-Mullvad add-on is the clean solution. It was purpose-built for this exact use case.
- Split tunneling (Mullvad feature) can also work but is more fragile.

**Recommended setup for your environment:**
1. Tailscale on all devices and Proxmox nodes (already in place).
2. Mullvad add-on for Tailscale for external traffic privacy.
3. Designate one Proxmox node as a Tailscale exit node for LAN devices that cannot run Tailscale directly.

**UNCERTAINTY:** The Mullvad add-on for Tailscale requires a Mullvad account and Tailscale subscription. Pricing and feature availability may change. Running raw WireGuard alongside Tailscale without the add-on is fragile and not recommended.

---

## 3. Distributed / Sovereign Infrastructure Vision

### 3.1 Radicle for Peer-to-Peer Knowledge Sharing

Radicle's architecture maps well to knowledge sharing:

**What works:**
- Any git repository can be seeded on Radicle. This includes the Observer Vault itself.
- Radicle COBs (Collaborative Objects) support discussions as first-class Git objects. Knowledge artifacts (motifs, patterns, insights) could be shared and discussed via COBs.
- Repositories are self-certifying. Knowledge provenance is cryptographically verifiable.
- Seeding policies let each node choose what to replicate. A sovereign node can seed exactly the repositories it cares about.
- Offline-first: nodes sync when connected, work independently when not.

**What does not work yet:**
- No rich media support (markdown only via git, no inline rendering).
- No search across the network (you need to know the RID or find it via a seed node).
- Discoverability is peer-dependent. No central index.
- No web UI for casual browsing by non-technical participants.

**Practical architecture:**
```
Observer Vault (git repo)
  |
  +-- Forgejo (primary forge, CI/CD, web UI, issues)
  |
  +-- Radicle seed node (sovereign backup, P2P distribution)
       |
       +-- Other trusted nodes can seed the vault
       +-- Gossip protocol propagates updates
       +-- COBs track discussions about knowledge artifacts
```

---

### 3.2 IPFS/IPNS for Content-Addressed Storage

**2025-2026 maturity assessment:**

IPFS has matured significantly for self-hosting in 2025:
- **DHT Provider Sweep:** 97% fewer lookups when providing many CIDs. Nodes can handle hundreds of thousands of CIDs without memory spikes. Runs on residential internet.
- **AutoTLS:** Automatic certificate provisioning for IPFS nodes.
- **IPNS TTL improvements:** Default TTL dropped from 1 hour to 5 minutes. Updates propagate much faster.
- **HTTP retrieval:** Content retrievable via standard HTTP, not just the IPFS protocol.
- **Helia:** Browser-based trustless retrieval works.

**Practical for a sovereign setup?** PARTIALLY.

**Good fit:**
- Content-addressed storage for immutable artifacts (published documents, signed releases, dataset snapshots).
- Distributing large files across nodes without central server.
- Pinning services for ensuring content availability.

**Poor fit:**
- Mutable state (IPNS works but adds complexity and latency vs. git).
- Private content (IPFS is designed for public content. Private IPFS requires additional encryption layers).
- Real-time collaboration (IPFS is eventually consistent with variable latency).

**For the Observer ecosystem specifically:**
- Published motif library snapshots could be content-addressed.
- Dataset processor outputs could be pinned for distribution.
- The vault itself is better served by git (Radicle or Forgejo) than IPFS, because it is highly mutable.

**UNCERTAINTY:** IPFS garbage collection and pinning management add operational complexity. Running a reliable IPFS node requires attention to disk usage and DHT health. The ecosystem is still fragmented across implementations (Kubo, Iroh, Helia).

---

### 3.3 "Sovereign Node Network" -- Technical Architecture

A concrete vision of what this looks like:

```
NODE A (Primary -- Polaris Proxmox)          NODE B (Remote -- e.g., VPS or friend's hardware)
+-----------------------------+              +-----------------------------+
| Proxmox VE (bare metal)    |              | Proxmox VE (bare metal)    |
|  +-- ZFS storage           |              |  +-- ZFS storage           |
|  +-- LXC: Forgejo          |              |  +-- LXC: Forgejo mirror   |
|  +-- LXC: Radicle node     |  <--P2P-->  |  +-- LXC: Radicle node     |
|  +-- LXC: IPFS node        |  <--P2P-->  |  +-- LXC: IPFS node        |
|  +-- VM: Workloads         |              |  +-- VM: Workloads         |
|  +-- Tailscale             |  <--mesh-->  |  +-- Tailscale             |
+-----------------------------+              +-----------------------------+
        |                                            |
        +--- Mullvad exit (external traffic) ---------+
```

**Layer 1 -- Physical:** Each node is a Proxmox host with ZFS for storage integrity and snapshots.

**Layer 2 -- Mesh connectivity:** Tailscale provides zero-config encrypted mesh between all nodes. No public IPs needed. Works behind NAT/CGNAT via DERP relays.

**Layer 3 -- Privacy for external traffic:** Mullvad via Tailscale exit nodes. Internal traffic stays on the mesh.

**Layer 4 -- Git replication:**
- Forgejo: Mirror repos between instances (built-in mirror feature).
- Radicle: Gossip-based replication. Each node seeds repos it cares about. Self-certifying verification.
- ZFS send/receive for full-state backup replication between nodes.

**Layer 5 -- Content distribution:**
- IPFS for published, immutable artifacts.
- Radicle for code and knowledge repositories.
- ZFS snapshots for point-in-time recovery.

**Layer 6 -- Sovereignty guarantees:**
- All software is open source (Proxmox, Forgejo, Radicle, IPFS, Tailscale client, WireGuard).
- No dependency on any single hosted service for core functionality.
- Tailscale coordination server is the single centralized dependency. Mitigated by: Headscale (self-hosted Tailscale control plane) as an escape hatch.
- Data never leaves your control. Mullvad sees encrypted traffic, not content.

---

### 3.4 How Tailscale Fits

Tailscale is the connective tissue:

| Role | How Tailscale serves it |
|------|------------------------|
| Node-to-node connectivity | WireGuard mesh, automatic key management, NAT traversal |
| Access control | ACLs define which nodes can reach which services |
| DNS | MagicDNS provides stable names for all nodes |
| Exit nodes | Route external traffic through Mullvad or a specific node |
| Subnet routing | Expose LAN segments to the mesh without installing Tailscale on every device |
| SSH | Tailscale SSH for node access without managing SSH keys |

**The Headscale escape hatch:**
- Headscale is a self-hosted, open-source implementation of the Tailscale control server.
- If Tailscale Inc. changes pricing, policies, or goes away, Headscale provides continuity.
- Currently mature enough for personal/small team use.
- Trade-off: you lose Tailscale's managed DERP relays and some features. Can self-host DERP relays too.

**UNCERTAINTY:** Tailscale's free tier and pricing have changed before and may change again. Headscale compatibility with newer Tailscale client features can lag.

---

## 4. Recommended Architecture for Your Setup

Based on this research, here is the recommended sovereign stack:

### Primary Forge: Forgejo
- Run in LXC container on Proxmox.
- ~512MB RAM allocation (generous for solo use).
- Forgejo Actions with self-hosted runner for CI/CD.
- Container registry for Docker images.
- Built-in GitHub migrator for initial migration.
- ZFS snapshots for backup (SQLite + bare repos).

### Sovereign Backup: Radicle
- Run a seed node alongside Forgejo.
- Push to both Forgejo and Radicle.
- Provides: P2P distribution, cryptographic verification, offline-capable, no single point of failure.
- Future potential: federation with other sovereign nodes.

### Mesh: Tailscale (already deployed)
- Continue using for inter-node connectivity.
- Add Mullvad exit nodes for external traffic privacy.
- Headscale as documented escape hatch.

### External Privacy: Mullvad
- WireGuard via Tailscale integration for simplicity.
- Fallback: raw `wg-quick` configs for non-Tailscale scenarios.
- Pay with Monero or cash for maximum anonymity.

### Content Distribution (optional, future): IPFS
- For published artifacts, dataset snapshots, immutable releases.
- Not for mutable state (use git for that).
- Deploy when there is a concrete distribution need.

### What NOT to deploy:
- GitLab CE: Overkill. 20-40x resource cost for marginal benefit.
- cgit alone: Too limited for collaboration. Fine as a read-only public mirror.
- Soft Serve alone: Beautiful but insufficient. Fine as a secondary SSH-only access point.

---

## 5. Uncertainties and Open Questions

| Area | Uncertainty | Impact | Mitigation |
|------|-------------|--------|------------|
| Forgejo federation | Experimental, breaking changes expected | Cannot rely on federation for production workflows yet | Monitor monthly reports, treat as bonus feature |
| Radicle code review | "Rudimentary" -- unclear timeline to maturity | Cannot replace forge-based PR review | Use Forgejo for code review, Radicle for distribution |
| IPFS operational complexity | GC, pinning, DHT health require attention | May not be worth the overhead for small scale | Deploy only when concrete need arises |
| Tailscale pricing | Free tier may change | Could lose managed mesh | Headscale ready as fallback |
| Mullvad-Tailscale add-on | Requires both subscriptions | Cost consideration | Raw WireGuard configs as fallback |
| Headscale feature parity | Lags behind Tailscale client features | Some newer features may not work | Acceptable for core mesh functionality |
| Forgejo Actions vs GitHub Actions | "Familiar but not compatible" | Some Actions may need adaptation | Most common Actions work, test during migration |

---

## Sources

### Git Hosting
- [Forgejo - Beyond coding. We forge.](https://forgejo.org/)
- [Forgejo comparison with Gitea](https://forgejo.org/compare-to-gitea/)
- [Forgejo Actions overview](https://forgejo.org/docs/next/user/actions/overview/)
- [Forgejo container registry](https://forgejo.org/docs/next/user/packages/container/)
- [Forgejo federation issue #59](https://codeberg.org/forgejo/forgejo/issues/59)
- [NLnet Federated Forgejo grant](https://nlnet.nl/project/Federated-Forgejo/)
- [Gitea open letter](https://gitea-open-letter.coding.social/)
- [Gitea and Forgejo late 2024 edition](https://chy.li/blog/gitea-and-forgejo)
- [Self-hosted Git platforms 2026 comparison](https://dasroot.net/posts/2026/01/self-hosted-git-platforms-gitlab-gitea-forgejo-2026/)
- [Radicle Protocol Guide](https://radicle.xyz/guides/protocol)
- [Radicle with GitHub Actions](https://radicle.xyz/2025/05/30/radicle-with-github-actions)
- [FOSDEM 2026 Radicle talk](https://fosdem.org/2026/schedule/event/TMQZTP-radicle/)
- [Radicle FAQ](https://radicle.xyz/faq)
- [GitLab installation requirements](https://docs.gitlab.com/install/requirements/)
- [GitLab memory-constrained environments](https://docs.gitlab.com/omnibus/settings/memory_constrained_envs/)
- [Soft Serve GitHub repo](https://github.com/charmbracelet/soft-serve)
- [Choosing a self-hosted Git service](https://www.paritybit.ca/blog/choosing-a-self-hosted-git-service/)
- [Migrating 200 projects to Forgejo](https://blog.hloth.dev/migrating-to-forgejo/)
- [GITHUB2FORGEJO migration tool](https://github.com/PatNei/GITHUB2FORGEJO)

### VPN/Privacy
- [Mullvad WireGuard Linux setup](https://mullvad.net/en/help/easy-wireguard-mullvad-setup-linux)
- [Mullvad Wikipedia](https://en.wikipedia.org/wiki/Mullvad)
- [Mullvad retires OpenVPN](https://www.techradar.com/vpn/vpn-services/mullvad-retires-openvpn-support-on-desktop-pushing-all-users-to-wireguard)
- [IVPN vs Mullvad comparison](https://www.shellfire.net/blog/ivpn-vs-mullvad/)
- [Privacy Guides VPN recommendations](https://www.privacyguides.org/en/vpn/)
- [Tailscale Mullvad integration](https://tailscale.com/blog/mullvad-integration)
- [Mullvad exit nodes on Tailscale](https://tailscale.com/kb/1258/mullvad-exit-nodes)
- [Accessing Tailscale with Mullvad](https://theorangeone.net/posts/tailscale-mullvad/)

### Distributed Infrastructure
- [IPFS Shipyard 2025 year in review](https://ipshipyard.com/blog/2025-shipyard-ipfs-year-in-review/)
- [IPFS self-hosting migration 2026](https://ipshipyard.com/blog/2026-ipfs-self-hosting-migration/)
- [Proxmox Kubernetes over Tailscale](https://github.com/Zanderskier/Proxmox-Kubernetes-Cluster-over-Tailscale-VPN)
- [Proxmox sovereign cloud infrastructure](https://dataonline.solutions/proxmox-infrastructure/)
- [Proxmox Ceph deployment](https://pve.proxmox.com/wiki/Deploy_Hyper-Converged_Ceph_Cluster)
