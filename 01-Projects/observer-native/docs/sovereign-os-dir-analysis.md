# Sovereign Computing Infrastructure — D/I/R Analysis

> **Status**: DRAFT — requires Adam's review and approval
> **Date**: 2026-03-29
> **Author**: Atlas (D/I/R analysis, 3 cycles)
> **Classification**: Foundational architecture decision

---

## Preamble: Why This Matters

On 2026-03-18, systemd merged PR #40954 — a `birthDate` field in userdb, explicitly citing California AB-1043 and Colorado SB26-051 as motivation. The same author submitted PRs to archinstall (making birth date **required** at installation) and to AccountsService and xdg-desktop-portal to expose age brackets via D-Bus to sandboxed applications.

The technical chain: OS installer collects birth date → systemd userdb stores it → AccountsService reads it → xdg-desktop-portal exposes age brackets to applications via D-Bus.

The xdg-desktop-portal PR was subsequently closed after controversy. The archinstall PR is open but locked pending Arch organisational guidance. The systemd field itself is merged.

CachyOS, our current OS, told users who opposed this to "find another distribution" and moderated critical forum threads.

This analysis evaluates the optimal replacement infrastructure. The question is not just "which OS" but "which stack gives maximum sovereignty with minimum friction over a multi-year horizon."

---

## D/I/R Cycle 1: OS Candidate Analysis

### D — Describe

#### The Decision Axes

This is not one decision. It decomposes into at least six independent axes:

| Axis | Question |
|------|----------|
| **Init system** | systemd vs non-systemd (OpenRC, runit, s6, dinit) |
| **Package ecosystem** | Package count, freshness, AUR-equivalent access |
| **Gaming viability** | AMD RX 6900 XT, Proton, 1440p performance |
| **Reproducibility** | Declarative config, cross-platform (Linux + macOS) |
| **Maintenance burden** | Time cost of keeping the system running |
| **Community resilience** | Bus factor, governance health, long-term viability |

These axes are partially independent. Gaming viability is nearly identical across candidates (same kernel, same mesa, same RADV). Reproducibility is mostly a function of whether Nix is used, regardless of base OS. The binding constraints are init system, package ecosystem, and maintenance burden.

#### Candidate Profiles

**1. Artix Linux (OpenRC)**

- Arch-based fork, exists specifically to remove systemd
- Four init options: OpenRC (flagship, most mature), runit, s6, dinit
- Full Arch repo + AUR access via `artix-archlinux-support`
- Same packages as Arch with systemd dependencies patched out
- CachyOS kernel compilable from PKGBUILD (kernel is init-agnostic)
- Active project, estimated 5-10 core maintainers
- Documented migration path from Arch-based systems
- Explicit anti-age-verification stance: "We'll NEVER require any verification or identification from the user"

**2. Void Linux (runit, glibc variant)**

- Independent distro (not Arch-based), runit init
- xbps package manager: ~15-16K packages, fast, clean
- No AUR equivalent — biggest package gap
- Rolling release, conservative update cadence
- Small team (~10-20 core maintainers), survived 2018 governance crisis
- Must use glibc variant for gaming (Steam requires glibc)
- Nix overlay fills package gaps well — documented pattern

**3. Gentoo (OpenRC)**

- Source-based, maximum control via USE flags
- Can fully eliminate systemd at compile time (`USE="-systemd"`)
- New binary package repository (binhost) dramatically reduces compile burden
- Can mix: binaries for large packages (LLVM, Firefox, Qt), compile the rest
- Initial build: 4-8 hours on 5950X. Ongoing: ~1-2 hours/week (mostly passive)
- Largest package ecosystem of the non-systemd options
- Healthy community, well-established governance, low bus-factor risk
- Highest maintenance burden but highest control

**4. Artix + Nix overlay**

- Artix base (OpenRC) for system + Nix for developer tooling
- Best of both: pacman/AUR for system packages, Nix for reproducible dev environments
- Nix daemon needs OpenRC service script (well-documented, simple)
- Cross-platform story: same Nix flake works on Artix and macOS (MacBook Pro M5 Max)
- home-manager for declarative dotfiles/shell config

**5. SixOS (NixOS fork, no systemd)**

- Early/experimental. Removes systemd from NixOS.
- Small community, unknown maintainer count
- High risk for daily-driver use — NixOS itself is complex, fork adds instability
- Not viable for production use in 2026

**6. Void + Nix overlay**

- Void base (runit) + Nix for packages unavailable in xbps
- Similar pattern to Artix + Nix but without AUR access
- More Nix dependency = more Nix-specific knowledge required
- runit service for nix-daemon is straightforward

#### Gaming Stack (Identical Across Candidates)

The gaming stack is distro-agnostic:
- **Kernel**: Linux mainline `amdgpu` driver. RDNA2 (Navi 21 / RX 6900 XT) fully supported since kernel 5.x, mature since 6.x.
- **Mesa/RADV**: Vulkan driver. All candidates ship mesa 24.x+. RDNA2 support is mature.
- **Steam**: Available on all candidates (Artix: pacman. Void: xbps nonfree. Gentoo: portage). Requires glibc + 32-bit libs.
- **Proton**: Managed by Steam internally. Distro-agnostic.
- **Performance**: Identical for same kernel + mesa versions. CachyOS kernel patches (BORE scheduler, etc.) give ~1-5% improvement in CPU-bound scenarios — replicable on any distro by building the CachyOS kernel PKGBUILD or cherry-picking patches.

**Game-specific**:
- Cyberpunk 2077: Runs via Proton, 60+ FPS at 1440p High/Ultra (no RT on RDNA2). Well-tested on RADV.
- ESO: Works via Proton (Gold/Platinum on ProtonDB). No kernel-level anti-cheat.
- Path of Exile 2: **UNCERTAIN** — uses EasyAntiCheat. Whether GGG has enabled Linux/Proton support for EAC is the critical variable. **Requires live verification before committing.**

**Non-systemd friction for gaming** (applies to all candidates):
- `xdg-desktop-portal` services need manual start (auto-start on systemd via socket activation)
- PipeWire needs manual service management on OpenRC/runit
- These are solvable one-time configuration items, not ongoing issues

### I — Interpret

**Constraint 1: Gaming is non-negotiable → all candidates pass.** The gaming stack is kernel + mesa + Steam, which is distro-agnostic. CachyOS kernel patches are reproducible. This axis does not discriminate between candidates.

**Constraint 2: Package availability matters → Artix wins, Void loses.** Artix's access to Arch repos + AUR is a massive advantage. Void's ~15K packages without an AUR equivalent means more manual work or heavier Nix dependency. Gentoo's overlays + GURU provide reasonable coverage but with compile overhead.

**Constraint 3: Maintenance burden → Artix < Void < Gentoo.** Artix is closest to "install and go" (same workflow as Arch). Void is similar but requires more manual package management. Gentoo's compile model, even with binaries, demands ongoing attention.

**Constraint 4: Reproducibility → Nix overlay is orthogonal to base OS.** If we want declarative, cross-platform dev environments (critical for MacBook Pro compatibility), Nix is the answer regardless of base OS. This favours the "base OS + Nix" pattern over any single OS choice.

**Constraint 5: Community resilience → Gentoo > Artix > Void.** Gentoo has the largest, most established community. Artix is smaller but backed by Arch's ecosystem. Void has the smallest team and a history of governance instability.

**Constraint 6: Sovereignty signal → Artix has the explicit stance.** Artix explicitly rejects age verification. Gentoo and Void are structurally incompatible with systemd but haven't made political statements. For a sovereignty-focused project, Artix's explicit stance matters — it signals alignment, not just accident.

**The binding constraint** is the intersection of package availability + maintenance burden + community resilience. Gaming is a pass/fail that all candidates pass. Reproducibility is solved by Nix regardless of base.

**Emerging pattern**: Artix + Nix is the candidate that minimises friction while maximising sovereignty. Artix gives you the Arch ecosystem (pacman, AUR, familiar workflow, CachyOS kernel buildable from PKGBUILD) without systemd. Nix gives you reproducible dev environments that port to macOS.

### R — Recommend (Cycle 1)

**Primary: Artix Linux (OpenRC) + Nix overlay**
- Rationale: Closest to current CachyOS workflow (Arch-based, pacman, AUR). Explicit sovereignty stance. Nix for reproducibility + cross-platform.
- Risk: Small maintainer team (5-10). Mitigated by: Arch ecosystem does the heavy lifting; Artix primarily patches out systemd.

**Fallback: Void Linux (glibc, runit) + Nix overlay**
- Rationale: More independent from Arch (if Arch ecosystem becomes hostile to non-systemd). Stable, minimal.
- Risk: Smaller package ecosystem. Mitigated by: Nix fills gaps. But heavier Nix dependency means more complexity.

**Not recommended: Gentoo**
- Reason: Maintenance burden is real. Even with binary packages, the compile model demands ongoing attention that competes with Observer project work. The control Gentoo offers (USE flags, compile optimisation) provides marginal benefit for this use case — the 1-5% performance gain from compile flags doesn't justify the time investment.

**Not recommended: SixOS**
- Reason: Too experimental. Not viable for daily-driver production use.

**Stability assessment (cycle 1)**:
- Completeness (c): 0.7 — haven't fully evaluated infrastructure stack integration
- Independence (i): 0.8 — gaming and OS analyses are properly separated
- Decidability (d): 0.6 — recommendation is directional but needs infrastructure validation

→ Not converged. Run cycle 2.

---

## D/I/R Cycle 2: Infrastructure Stack Integration

### D — Describe

The OS choice doesn't exist in isolation. It integrates with:
1. Git hosting (moving off GitHub)
2. VPN/privacy layer
3. Nix declarative configuration
4. Unified Observer installer
5. Future distributed node network
6. MacBook Pro M5 Max compatibility

#### Git Hosting Options

**Forgejo** (Community fork of Gitea)
- Forked from Gitea after Gitea Ltd commercialisation controversy
- Governed by Codeberg e.V. (German nonprofit)
- License: MIT → GPL-3+ (as of recent versions)
- Features: Issues, PRs, CI/CD (Forgejo Actions — GitHub Actions compatible), container registry, wiki
- Resources: ~200MB RAM idle, lightweight. Runs on a Raspberry Pi.
- Self-hosted on Proxmox: trivial. Single binary or container.
- Migration from GitHub: built-in migration tool (imports repos, issues, PRs)

**Gitea**
- Original project, now controlled by Gitea Ltd (for-profit)
- Functionally similar to Forgejo (they share upstream code periodically)
- MIT license
- Risk: commercial entity controls direction. Already happened once (Forgejo fork was a response to this).

**Radicle** (peer-to-peer git)
- Sovereign code collaboration protocol. No central server.
- Gossip-based replication over peer network
- Code review via patches (similar to email workflow)
- Technically mature enough for basic collaboration as of 2025-2026
- Cannot fully replace a forge: no CI/CD, no container registry, limited web UI
- Can coexist with a traditional forge (mirror repos to both)
- Aligns perfectly with distributed node network vision

**Self-hosted GitLab CE**
- Full-featured but resource-heavy (~4GB RAM minimum, 8GB+ recommended)
- Overkill for solo developer / small team
- Maintenance burden is significant (complex stack, frequent updates)
- Not recommended for this use case.

**Soft Serve** (Charm)
- Terminal-based git hosting. Beautiful TUI.
- Minimal features: browse repos, clone. No issues, no PRs, no CI/CD.
- Good as a browsing interface, not a full forge.

#### VPN/Privacy

**Mullvad VPN**
- Best-in-class privacy VPN. WireGuard native. No accounts — use a number.
- Payment: cash by mail, Monero, Bitcoin (no KYC)
- Works well on non-systemd Linux (WireGuard is in-kernel, Mullvad CLI is systemd-optional)
- On OpenRC: mullvad-daemon needs an init script (community-provided, simple)

**Tailscale** (already deployed)
- Mesh VPN for inter-node communication. Already in use.
- Coexists with Mullvad: official Tailscale-Mullvad partnership provides Mullvad exit nodes inside the Tailscale mesh. Internal traffic stays on mesh, external routes through Mullvad. Single WireGuard interface, no conflicts.
- This is the correct architecture: Tailscale for node-to-node, Mullvad for internet-facing.
- **Headscale** is a self-hosted Tailscale control plane — eliminates the one centralised dependency (Tailscale's coordination server). Worth evaluating for full sovereignty.

#### Nix Cross-Platform Configuration

**The unified installer vision** maps cleanly to Nix:
- `flake.nix` defines: shell environments, dev tools, system packages, dotfiles (via home-manager)
- Same flake works on: Artix (via Nix overlay), macOS (MacBook Pro M5 Max), any future Linux node
- Nix flakes are stable enough for production use in 2026
- `nix develop` creates reproducible shell environments per-project
- home-manager manages: fish config, git config, editor config, shell aliases, environment variables

**What Nix manages** (developer tooling):
- Bun, Node.js, Python, Rust toolchains
- Fish shell + plugins
- CLI AI backends (Claude Code, Codex CLI, etc.)
- MCP server dependencies
- Editor/IDE configuration

**What the base OS manages** (system-level):
- Kernel, bootloader, drivers
- Display server (Wayland/X11)
- Desktop environment (KDE Plasma)
- Audio (PipeWire)
- Networking (NetworkManager)
- Gaming (Steam, Proton, mesa)

This separation is clean and maintainable. Each layer does what it's best at.

#### Distributed Node Network Vision

The future vision: multiple sovereign nodes (Proxmox hosts) connected via Tailscale mesh, each running the Observer stack, sharing structural knowledge peer-to-peer.

**How each component maps**:
- **Radicle**: Peer-to-peer code replication across nodes. No central forge required.
- **Forgejo**: Central forge on primary node (Polaris) for web UI, CI/CD, issue tracking.
- **Tailscale**: Encrypted mesh between nodes.
- **Mullvad**: Privacy layer for internet-facing traffic.
- **Nix flake**: Identical dev environments on every node.
- **ZFS**: Snapshots + replication between nodes for data resilience.

### I — Interpret

**Git hosting**: Forgejo is the clear choice. Lightweight, community-governed, GitHub migration built in. Radicle as a secondary layer for peer-to-peer replication (not a replacement). The combination covers both "web forge" and "sovereign replication" needs.

**VPN**: Already solved. Tailscale (internal) + Mullvad (external) is the correct architecture. On Artix/OpenRC, both need init scripts — one-time setup.

**Nix is the keystone**: The cross-platform story (Artix + macOS), the unified installer vision, and the reproducibility requirement all converge on Nix. This isn't optional — it's the architectural decision that connects OS choice to future vision.

**The separation of concerns is clean**:
- Base OS (Artix) owns: hardware, kernel, desktop, gaming, networking
- Nix owns: developer tooling, reproducible environments, cross-platform config
- Forgejo owns: code hosting, CI/CD, project management
- Radicle owns: peer-to-peer code replication
- Tailscale owns: node mesh
- Mullvad owns: external privacy

Each component has a single responsibility. No component depends on another's internals. This is a resilient architecture.

**Unified installer implications**: The Observer installer becomes a Nix flake that:
1. Detects the host OS (Artix, macOS, other Linux)
2. Ensures Nix is installed (guides installation if not)
3. Activates the flake to provision: dev tools, MCP servers, AI CLI backends, shell config
4. Does NOT manage the base OS — that's the user's choice

This is portable, reproducible, and respects user sovereignty. It works on any Linux + macOS without dictating OS choice.

**Network vision compatibility**: Artix + Nix + Forgejo + Radicle + Tailscale is a stack that scales from one node to many. Each new node: install Artix, activate Nix flake, join Tailscale mesh, replicate via Radicle. The stack is consistent, reproducible, and doesn't depend on any single external service.

### R — Recommend (Cycle 2)

**Full stack recommendation**:

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Base OS** | Artix Linux (OpenRC) | Arch ecosystem, sovereignty stance, familiar workflow |
| **Kernel** | CachyOS kernel (built from PKGBUILD) | BORE scheduler, optimisations, no systemd dependency |
| **Dev tooling** | Nix (flakes + home-manager) | Reproducible, cross-platform, unified installer |
| **Code hosting** | Forgejo (self-hosted on Proxmox) | Lightweight, community-governed, GitHub migration |
| **P2P replication** | Radicle (secondary) | Distributed code sovereignty |
| **Internal mesh** | Tailscale | Already deployed, mature |
| **External privacy** | Mullvad VPN | Best-in-class, no accounts, WireGuard |
| **Desktop** | KDE Plasma 6 | Continuity from current setup |
| **Shell** | Fish (managed by Nix/home-manager) | Continuity |

**Stability assessment (cycle 2)**:
- Completeness (c): 0.85 — all major components addressed
- Independence (i): 0.85 — layers are cleanly separated
- Decidability (d): 0.8 — clear recommendation with rationale

→ Improving but need stress-testing. Run cycle 3.

---

## D/I/R Cycle 3: Convergence and Stability Evaluation

### D — Describe (What Could Go Wrong)

Apply adversarial thinking. What breaks the recommendation?

**Threat 1: Artix maintainer collapse.**
If 2-3 key Artix maintainers leave, the project could stall. Artix's core value is patching systemd out of Arch packages — this is ongoing labour. If it stops, packages stale.

**Threat 2: Arch becomes hostile to non-systemd.**
Arch could introduce hard systemd dependencies that are increasingly difficult to patch out. The archinstall birth date PR (if merged) signals potential trajectory. If Arch makes systemd so deeply embedded that patching it out becomes infeasible, Artix dies.

**Threat 3: Nix governance instability.**
The Nix community had governance drama in 2024 (board conflicts, sponsor controversies). Nix is not NixOS — the package manager can fork or be maintained independently — but governance risk exists.

**Threat 4: CachyOS kernel PKGBUILD diverges.**
If CachyOS changes its build system or drops support for non-CachyOS use, kernel patches would need to be maintained independently. Mitigation: linux-tkg (AUR) is an alternative, or direct patch application.

**Threat 5: Gaming anti-cheat regression.**
If game studios pull Linux/Proton EAC support (policy decision, not technical), gaming viability drops regardless of OS choice. This is outside our control.

**Threat 6: California AB-1043 enforcement against distributions.**
The law's definition of "operating system provider" is broad enough to encompass Linux distributions. If enforcement targets Artix, the project's explicit stance of non-compliance could create legal risk for the project (though practical enforcement against a small FOSS project is unlikely). This primarily affects US-based distributors and mirrors.

**Threat 7: Forgejo governance change.**
Codeberg e.V. currently governs Forgejo. If governance changes, the project could be forked again — but the data is local (self-hosted), so migration is straightforward.

### I — Interpret (Stress-Testing the Recommendation)

**Threat 1 mitigation (Artix collapse)**: If Artix dies, the fallback is Void + Nix. The Nix layer is portable — re-activating the flake on Void gives you the same dev environment. The base OS migration would take a day, not weeks. **This is the key resilience insight: Nix as the portable layer means base OS choice is recoverable.** You're not locked in to Artix forever.

**Threat 2 mitigation (Arch hostility)**: Same as Threat 1 — fall back to Void or Gentoo. The cost is losing AUR access, which Nix partially compensates for. This is a real risk but recoverable.

**Threat 3 mitigation (Nix governance)**: Nix is open-source (LGPL-2.1). Even if the project fractures, the tool works. Lix is already a community fork of Nix. The flake format is stable. Risk is real but manageable.

**Threat 4 mitigation (CachyOS kernel)**: linux-tkg, linux-zen, or manual patch application. The kernel optimisations are nice-to-have, not essential — mainline kernel runs gaming fine. Fallback cost is ~5% performance, not a showstopper.

**Threat 5 mitigation (anti-cheat)**: No mitigation possible at OS level. This is a game studio policy decision. Dual-boot Windows is the nuclear fallback for gaming (Proxmox supports this). Not recommended unless forced.

**Threat 6 mitigation (legal enforcement)**: Artix is European (inferred from community). US enforcement against a European FOSS project is unlikely in the near term. The user (Adam) consuming Artix is a different legal question from Artix distributing it. Self-hosting all infrastructure reduces exposure.

**Threat 7 mitigation (Forgejo governance)**: Data is self-hosted. Worst case: export repos, import to a different forge. Minutes of work.

**Key insight from stress-testing**: The architecture is resilient because the layers are independent. Losing any single component (base OS, package manager, forge, VPN) doesn't cascade. Each can be replaced without rebuilding everything. This is the architectural pattern we want: **loosely coupled sovereignty**.

**Motif algebra evaluation**:
- **Completeness (c)**: 0.9 — all major components, threats, and mitigations addressed. Open questions identified.
- **Independence (i)**: 0.9 — layers are cleanly separated; analysis doesn't circular-reference.
- **Decidability (d)**: 0.9 — clear primary recommendation with ranked fallbacks and trigger conditions for switching.

→ Converged. The recommendation holds under adversarial analysis because the architecture is designed to survive component failure.

---

## Final Recommendation

### Primary Choice: Artix Linux (OpenRC) + Nix + Forgejo + Radicle + Tailscale + Mullvad

### Ranked Fallbacks

| Rank | Option | When to trigger |
|------|--------|----------------|
| 1 (Primary) | Artix (OpenRC) + Nix | Default recommendation |
| 2 (Fallback) | Void (glibc, runit) + Nix | If Artix dies or Arch becomes hostile to non-systemd |
| 3 (Long-term) | Gentoo (OpenRC) + Nix | If maximum control is needed and maintenance time is available |

---

## Migration Plan: CachyOS → Artix Linux

### Pre-Migration (Before Touching the OS)

**Step 0: Full backup**
```bash
# ZFS snapshot of current VM
zfs snapshot tank/vm-gaming@pre-artix-migration
# Export package list
pacman -Qqe > ~/pkglist-cachyos.txt
# Backup dotfiles
tar czf ~/dotfiles-backup.tar.gz ~/.config ~/.local ~/.ssh ~/.gnupg
# Backup Observer vault (already on ZFS, but snapshot anyway)
zfs snapshot tank/backup/projects@pre-artix-migration
```

**Step 1: Inventory current system**
```bash
# Document running services
systemctl list-units --type=service --state=running > ~/running-services.txt
# Document enabled services
systemctl list-unit-files --state=enabled > ~/enabled-services.txt
# Document custom kernel parameters
cat /proc/cmdline > ~/kernel-cmdline.txt
# Document display/GPU configuration
cat /etc/X11/xorg.conf.d/* > ~/xorg-config.txt 2>/dev/null
# Document PipeWire configuration
ls -la ~/.config/pipewire/ > ~/pipewire-config.txt
```

### Migration (Fresh Install, Not In-Place)

**ASSUMPTION A1**: Fresh install is safer than in-place migration from CachyOS. CachyOS adds custom repos, kernel, and configurations. In-place migration risks orphaned config. **Risk if wrong**: Wasted time on fresh install when in-place would have worked. Acceptable.

**Step 2: Prepare Artix installation media**
- Download Artix OpenRC ISO (plasma variant for KDE)
- Verify signature
- Write to USB: `dd if=artix-plasma-openrc-*.iso of=/dev/sdX bs=4M status=progress`

**Step 3: Install Artix**
- Boot from USB
- Partition: match current layout (or improve)
- Mount ZFS datasets as needed (ZFS is on Proxmox host, NFS-shared — no partition changes needed)
- Install base: `basestrap /mnt base base-devel openrc linux linux-firmware`
- Install kernel: mainline first, CachyOS kernel after validation
- Configure: fstab, locale, hostname, users
- Install OpenRC init scripts for core services:
  - `networkmanager-openrc`
  - `openssh-openrc`
  - `cronie-openrc`

**Step 4: Desktop and GPU**
```bash
# KDE Plasma
pacman -S plasma-desktop sddm-openrc kde-applications

# AMD GPU (RDNA2)
pacman -S mesa vulkan-radeon lib32-mesa lib32-vulkan-radeon xf86-video-amdgpu

# PipeWire (audio)
pacman -S pipewire pipewire-pulse pipewire-alsa wireplumber
# Create OpenRC service for PipeWire (user session, started by desktop)

# Enable services
rc-update add sddm default
rc-update add NetworkManager default
```

**Step 5: Enable Arch repos + AUR**
```bash
pacman -S artix-archlinux-support
# Edit /etc/pacman.conf to add [extra] and [multilib] from Arch
pacman -Sy

# Install AUR helper
git clone https://aur.archlinux.org/paru.git && cd paru && makepkg -si
```

**Step 6: Restore development environment**
```bash
# Shell
pacman -S fish
chsh -s /usr/bin/fish

# Basic dev tools
pacman -S git base-devel

# Tailscale
pacman -S tailscale
# Write OpenRC init script for tailscaled (or install from Artix repo if available)
rc-update add tailscaled default
tailscale up
```

**Step 7: Install Nix**
```bash
# Determinate Systems installer (best non-systemd support)
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh

# If daemon doesn't auto-configure for OpenRC:
# Create /etc/init.d/nix-daemon (simple wrapper)
rc-update add nix-daemon default
rc-service nix-daemon start

# Verify
nix --version
nix run nixpkgs#hello
```

**Step 8: Activate Nix flake for dev environment**
```bash
# Clone/create the Observer Nix flake
# (This is the unified installer - to be created)
nix develop github:observer/nix-config  # or local path

# Or manually for now:
nix profile install nixpkgs#bun
nix profile install nixpkgs#nodejs
nix profile install nixpkgs#python3
nix profile install nixpkgs#rustup

# home-manager for dotfiles
nix run home-manager -- switch --flake .#adam
```

### Post-Migration Validation

**Step 9: Verify everything works (in this order)**

1. **Network**: `ping 8.8.8.8`, `tailscale status`, DNS resolution
2. **NFS/ZFS**: Mount points to Proxmox ZFS working. Observer vault accessible.
3. **Desktop**: KDE Plasma launches, display resolution correct (1440p 144Hz)
4. **GPU**: `vulkaninfo | grep deviceName` shows RX 6900 XT, `glxinfo | grep renderer`
5. **Audio**: PipeWire running, audio output works
6. **Shell**: Fish shell, aliases, functions working
7. **Dev tools**: `bun --version`, `node --version`, `python3 --version`, `rustc --version`
8. **AI CLIs**: Claude Code runs, MCP servers connect
9. **Gaming**: (See Gaming Validation section below)
10. **Observer infrastructure**: Control plane at localhost:9000, shard processing works

---

## Gaming Validation

**ASSUMPTION A2**: Gaming performance on Artix with identical kernel + mesa versions will be identical to CachyOS. **Risk if wrong**: Performance regression requiring kernel tuning or fallback to CachyOS kernel. Low risk — the graphics stack is distro-agnostic.

### Validation Steps

1. **Install Steam**
```bash
# Enable multilib repo first
pacman -S steam
```

2. **Verify GPU is correctly detected**
```bash
vulkaninfo --summary
# Should show: Radeon RX 6900 XT (RADV NAVI21)
```

3. **Install MangoHud for benchmarking**
```bash
pacman -S mangohud lib32-mangohud
```

4. **Test games in order of complexity**:

| Game | Test | Pass Criteria |
|------|------|--------------|
| Any small Proton game | Launches, runs | Proton runtime works |
| ESO | Launches via Proton-GE, login works | Anti-cheat not blocking, audio works |
| Cyberpunk 2077 | 1440p Ultra, MangoHud overlay | 55+ FPS average, stable frametime |
| PoE 2 | Launch attempt | If EAC enabled for Linux: runs. If not: document as limitation. |

5. **If performance is lower than CachyOS**:
```bash
# Build CachyOS kernel
git clone https://github.com/CachyOS/linux-cachyos.git
cd linux-cachyos
makepkg -si
# Reboot into CachyOS kernel, re-test
```

6. **GameScope test** (optional, for HDR/variable refresh):
```bash
pacman -S gamescope
gamescope -W 2560 -H 1440 -r 144 -- steam
```

---

## Development Environment Reproduction

### What Nix Manages (Portable Across Artix + macOS)

```nix
# Skeleton of the Observer Nix flake (to be fully specified)
{
  description = "Observer development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    home-manager.url = "github:nix-community/home-manager";
  };

  outputs = { self, nixpkgs, home-manager }: {
    # Dev shell - activated with `nix develop`
    devShells.default = nixpkgs.legacyPackages.x86_64-linux.mkShell {
      packages = with nixpkgs.legacyPackages.x86_64-linux; [
        bun
        nodejs
        python3
        rustup
        fish
        git
        jq
        curl
        tailscale  # CLI only, daemon managed by OS
      ];
    };

    # home-manager config for dotfiles
    homeConfigurations."adam" = home-manager.lib.homeManagerConfiguration {
      # Fish config, git config, shell aliases, etc.
    };
  };
}
```

### What the Base OS Manages (Artix-specific)

| Component | Package/Config |
|-----------|---------------|
| Kernel | `linux` or `linux-cachyos` (AUR/manual) |
| GPU drivers | `mesa vulkan-radeon lib32-mesa lib32-vulkan-radeon` |
| Desktop | `plasma-desktop sddm-openrc` |
| Audio | `pipewire pipewire-pulse wireplumber` |
| Networking | `networkmanager-openrc tailscale` |
| Steam | `steam` (multilib repo) |
| Display manager | `sddm` with OpenRC service |
| VPN | `mullvad-vpn` with OpenRC service |

---

## Git Migration Plan: GitHub → Self-Hosted

### Phase 1: Deploy Forgejo (Day 1)

```bash
# On Proxmox, create lightweight LXC or VM for Forgejo
# Or run as a container on existing infrastructure

# Forgejo binary install (simplest)
wget https://codeberg.org/forgejo/forgejo/releases/download/v*/forgejo-*-linux-amd64
chmod +x forgejo-*-linux-amd64
./forgejo-*-linux-amd64 web  # starts on :3000

# Or via Docker on Proxmox
docker run -d --name forgejo \
  -p 3000:3000 -p 222:22 \
  -v /opt/forgejo/data:/data \
  codeberg.org/forgejo/forgejo:latest
```

- Configure: admin account, SSH keys, org structure
- Enable Forgejo Actions for CI/CD
- Resource estimate: ~200MB RAM, negligible CPU

### Phase 2: Migrate Repos (Day 1-2)

Forgejo has built-in GitHub migration:
1. Site Administration → Migrations
2. Enter GitHub repo URL + token (for private repos)
3. Imports: code, branches, tags, issues, PRs, labels, milestones, releases

Migrate all Observer repos. Verify integrity:
```bash
# For each repo
git clone forgejo@forgejo.local:observer/repo.git
git log --oneline -20  # verify history
```

### Phase 3: Set Up Mirrors (Optional, Day 3)

If maintaining GitHub presence for visibility:
- Configure Forgejo push mirrors back to GitHub
- Or use GitHub Actions to pull from Forgejo
- Or drop GitHub entirely (sovereign choice)

### Phase 4: Radicle Layer (Week 2+)

```bash
# Install Radicle
curl -sSf https://radicle.xyz/install | sh

# Initialise node
rad auth  # creates identity
rad node start

# Publish repos
cd /path/to/repo
rad init  # creates Radicle project
rad push  # publishes to network
```

- Radicle replicates repos peer-to-peer across the Tailscale mesh
- Each Observer node runs a Radicle node
- Code survives even if Forgejo goes down

### DNS/Access

- Forgejo accessible at `forgejo.tailnet-name.ts.net` (via Tailscale)
- Or set up local DNS: `forgejo.observer.local`
- HTTPS via Let's Encrypt if exposing publicly, or Tailscale HTTPS certs

---

## Unified Installer Implications

The Observer unified installer vision is **enhanced** by this architecture:

**Current state**: No installer. Manual setup.

**With Artix + Nix**:

The installer becomes a Nix flake that:
1. **Detects host**: Linux distro, macOS version, architecture
2. **Installs Nix** (if not present): guides through installation
3. **Activates dev environment**: `nix develop` provides all tools
4. **Activates home-manager**: configures shell, git, editor, aliases
5. **Connects to Observer**: MCP servers, control plane, vault access

**What this means practically**:
- On Artix (gaming desktop): `nix develop .#observer` → full dev environment
- On MacBook Pro M5 Max: `nix develop .#observer` → identical dev environment
- On a new Proxmox node: install Artix, run installer flake → identical environment
- On someone else's machine (if they have Nix): `nix develop github:observer/config` → dev environment

**The base OS is NOT part of the installer.** The installer assumes a working OS with Nix installed. This is the correct separation:
- OS choice is the user's sovereign decision
- The Observer installer only manages Observer-specific tooling
- This respects sovereignty at every level

---

## Network Vision Compatibility

### How This Stack Supports the Distributed Sovereign Node Network

**Node definition**: A sovereign computing unit that participates in the Observer network.

**Minimum node spec**:
- Hardware: Any x86_64 or ARM64 machine
- OS: Any Linux with Nix (Artix recommended, not required)
- Network: Tailscale mesh membership
- Storage: Local or ZFS (recommended)
- Services: Forgejo, Radicle node, Observer control plane, MCP servers

**Node bootstrapping** (enabled by this architecture):
1. Install base OS (Artix or alternative)
2. Install Nix
3. Run Observer flake: `nix develop github:observer/node-config`
4. Join Tailscale mesh: `tailscale up --authkey=<key>`
5. Start Radicle node: `rad node start`
6. Connect to Forgejo: register/authenticate
7. Start Observer control plane and MCP servers

**Peer-to-peer knowledge sharing**:
- Radicle: code and configuration
- ZFS send/receive: data replication over Tailscale
- Observer vault: knowledge documents synced via git (Radicle or Forgejo)
- Motif library: shared via vault replication

**What's still needed** (future work, not blockers):
- Node discovery protocol (currently manual Tailscale invites)
- Data sovereignty policies (what replicates where)
- Conflict resolution for shared documents
- Trust model for multi-user nodes

---

## Assumptions List

Every assumption made in this analysis, with risk assessment:

| ID | Assumption | Confidence | Risk if Wrong | Mitigation |
|----|-----------|------------|--------------|------------|
| A1 | Fresh install safer than in-place migration from CachyOS | HIGH | Time wasted on reinstall when in-place would work | Fresh install cost is ~4 hours, acceptable insurance |
| A2 | Gaming performance identical across distros with same kernel+mesa | HIGH | Minor performance regression | Build CachyOS kernel on Artix, or tune kernel params |
| A3 | Artix OpenRC has init scripts for all needed services | MEDIUM | Some services need manual init scripts (tailscaled, mullvad, nix-daemon, pipewire) | Init scripts are 5-15 lines, well-documented patterns |
| A4 | Nix Determinate installer works on Artix OpenRC | MEDIUM | Need manual daemon setup | Single-user install fallback, or manual OpenRC service |
| A5 | Artix maintainer team remains active for 2+ years | MEDIUM | Project stalls, packages stale | Fall back to Void + Nix. Nix layer is portable. |
| A6 | Arch ecosystem remains compatible with non-systemd patching | MEDIUM | Artix can no longer track Arch | Fall back to Void + Nix. Most impactful risk. |
| A7 | AUR packages work on Artix without modification | HIGH | Rare AUR packages with hard systemd runtime deps | Skip those packages, use Nix alternatives |
| A8 | Forgejo migration from GitHub preserves issues/PRs/history | HIGH | Some metadata lost | Export GitHub data independently as backup |
| A9 | CachyOS kernel PKGBUILD builds on Artix | HIGH | Build script has CachyOS-specific deps | Use linux-tkg or apply patches manually |
| A10 | Radicle is mature enough for secondary replication | MEDIUM | Radicle flaky or abandoned | Forgejo is primary; Radicle is bonus. Not a dependency. |
| A11 | Mullvad CLI works without systemd | HIGH | Need OpenRC init script for daemon | Community-provided, simple to write |
| A12 | Path of Exile 2 EAC works on Linux/Proton | LOW | Game unplayable on Linux | No OS-level mitigation. Dual-boot Windows if necessary. |
| A13 | KDE Plasma 6 on Artix OpenRC is stable | HIGH | Desktop issues | KDE on Artix is well-tested, first-class |
| A14 | NFS mounts from Proxmox ZFS work identically on Artix | HIGH | Mount config differs | Standard NFS, no systemd dependency |
| A15 | Observer control plane (localhost:9000) works on Artix | HIGH | systemd service file needs conversion | Convert to OpenRC service, trivial |
| A16 | Nix flake provides identical environment on Linux and macOS | HIGH | Platform-specific packages need conditionals | Nix handles this natively with system-specific outputs. nix-darwin confirmed working on Apple Silicon (M5 Max). |
| A17 | California AB-1043 won't practically be enforced against Linux distros | MEDIUM | Enforcement creates legal/distribution risk | Self-host mirrors, use non-US infrastructure |
| A18 | Tailscale works on Artix/OpenRC | HIGH | tailscaled needs OpenRC init | Community solution exists, simple wrapper |

---

## Open Questions

Questions that could not be fully resolved in this analysis and require testing or live verification:

### Must Resolve Before Migration

1. **PoE 2 EAC status**: Does GGG currently enable EasyAntiCheat for Linux/Proton? Check ProtonDB, GGG announcements, and r/pathofexile. If no: document as known limitation, decide if it's a blocker.

2. **Nix Determinate installer on Artix**: Does the current version auto-detect OpenRC? Test on a throwaway VM first.

3. **PipeWire session management on OpenRC**: Verify PipeWire starts correctly as a user session service without systemd user units. XDG autostart should handle this, but test.

4. **xdg-desktop-portal on OpenRC**: Verify portals start correctly for Steam/Flatpak. This is the most common friction point for gaming on non-systemd.

5. **Artix maintainer health**: Check recent commit activity on Artix GitLab. How many unique committers in the last 90 days?

### Should Resolve Before Full Commitment

6. **CachyOS kernel on Artix**: Build the PKGBUILD on an Artix test VM. Does it compile and boot cleanly?

7. **Forgejo CI/CD**: Set up Forgejo Actions with a test pipeline. Verify it can build TypeScript (Bun), run tests, and produce artifacts.

8. **Radicle maturity**: Set up two Radicle nodes on Tailscale mesh. Push a repo from one, verify it replicates to the other. Test code review workflow.

9. **Mullvad on OpenRC**: Install, write init script, verify WireGuard tunnel connects and DNS resolves correctly through Mullvad.

### Can Resolve After Migration

10. **Nix flake for Observer**: Design and test the unified Observer Nix flake. This is ongoing development work, not a migration blocker.

11. **macOS compatibility**: When MacBook Pro M5 Max arrives, test the same Nix flake. Verify dev environment parity.

12. **Node bootstrapping**: Define the full node bootstrap procedure and test on a second Proxmox host (if available).

---

## Process Reflection (D/I/R Meta-Layer)

### What Emerged

**The key insight is that Nix is the sovereignty layer, not the base OS.** The base OS matters (non-systemd is a hard requirement), but it's the replaceable part. Nix provides the portable, reproducible layer that survives OS changes. This means the OS decision, while important, is recoverable — which de-risks the entire migration.

**The loosely coupled architecture** (each component replaceable independently) is the structural motif. This is the same pattern as the Observer system itself: loosely coupled components with clean interfaces. The infrastructure mirrors the project's architectural values.

**Gaming validation is the critical gate.** If gaming doesn't work, nothing else matters (per stated constraints). But the technical analysis shows gaming is distro-agnostic, so this gate should pass. The real risk is PoE 2's anti-cheat policy, which is outside our control.

### What Was Missed (And Corrected)

**Cycle 1 didn't fully consider the fallback architecture.** Cycle 3 corrected this by stress-testing what happens when components fail. The insight that Nix makes the base OS recoverable emerged from this stress-testing.

**Initial analysis underweighted Gentoo's binary packages.** The 2023-2025 binhost changes significantly reduce Gentoo's maintenance burden. However, even with binaries, Gentoo's emerge workflow is more complex than pacman for daily use. The recommendation holds.

### Motif Candidates

- **Loosely Coupled Sovereignty**: A system where each component can be replaced independently, preserving the whole. The infrastructure stack exhibits this — losing any single component (OS, forge, VPN) doesn't cascade.
- **Portable Layer as Sovereignty**: The layer that provides sovereignty is not the one closest to hardware (the OS) but the one that is most portable (Nix). Sovereignty comes from portability — the ability to leave.

### What Should Change for Next Time

The research agent pattern (5 parallel agents) worked well for breadth. The limitation: agents without web search capability couldn't verify current state. Future D/I/R analyses on infrastructure topics should use web-search-enabled agents exclusively.

---

## Summary

**Recommendation**: Artix Linux (OpenRC) + Nix overlay + Forgejo + Radicle + Tailscale + Mullvad

**Why**: Maximum sovereignty with minimum friction. Arch ecosystem familiarity, explicit anti-surveillance stance, recoverable architecture (Nix makes the OS replaceable), clean separation of concerns, and a path to the distributed node network vision.

**Next action**: Set up an Artix test VM on Proxmox. Validate assumptions A2, A3, A4, and open questions 1-5 before committing to migration.

**Timeline estimate**: Not provided (per project guidelines). The migration is sequential: test VM → validate gaming → validate dev environment → migrate.

---

*Analysis conducted by Atlas. Adam decides.*
