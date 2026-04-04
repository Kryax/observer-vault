# Nix + Systemd-Free Sovereign Computing Research

> Status: DRAFT | Date: 2026-03-29 | Researcher: Dev (intern agent)

---

## 1. SixOS (NixOS Fork Without systemd)

### 1.1 What Is SixOS?

SixOS is a **nixpkgs-based operating system that replaces systemd with skarnet's s6** init/supervision suite. It was developed over two years by **Adam Joseph** (@amjoseph) and publicly released in **January 2025**, announced at **38C3** (Chaos Communication Congress, December 2024).

**Key distinction:** SixOS is **not a fork of NixOS**. It shares no code with NixOS's module system. Both SixOS and NixOS depend on `nixpkgs/pkgs` (the package set), but SixOS replaces the entire NixOS module/configuration layer with a novel system called **infuse.nix** -- a package-like combinator that treats services the same way nixpkgs treats packages.

- **Repository:** [codeberg.org/amjoseph/sixos](https://codeberg.org/amjoseph/sixos) (GPLv3, 428+ commits, 82 stars)
- **Demo:** [codeberg.org/amjoseph/six-demo](https://codeberg.org/amjoseph/six-demo)
- **Maintainer:** Adam Joseph (solo maintainer as of research date)

### 1.2 Init System

SixOS uses **s6** and **s6-rc** (service manager) from skarnet.org:
- s6 provides process supervision (PID 1 replacement)
- s6-rc provides dependency-based service management
- s6-linux-init handles the boot sequence
- Each service is a source folder (which can be a Nix derivation output), compiled into a coherent configuration set, then updated via `s6-rc-update`

The s6 service definition model maps naturally to Nix derivations, which is architecturally elegant.

### 1.3 Maturity / Daily Driver / Gaming

**Maturity: Early-stage but functional.**

- Deployed across "workstations, servers, routers, and a large-scale buildfarm" (per project claims)
- Supports verified full-disk encryption (noted as a "USP")
- Claims to support "full-fledged desktop environments"
- On "ownerboot" hardware, all mutable firmware is versioned and built as part of the SixOS configuration

**Daily driver: Not yet practical for most users.**

- Solo maintainer project
- Limited documentation
- No established binary cache (everything must be recompiled -- see 1.4)
- Home Manager compatibility is unclear/untested
- Community is very small

**Gaming: No specific information found.** [UNCERTAINTY] The project does not discuss gaming. Given the binary cache issue and the need to recompile packages without systemd linkage, gaming support (Steam, Proton, etc.) would require significant additional work. Steam in particular has deep systemd assumptions. This is a major gap for desktop daily-driver use.

### 1.4 Package Compatibility with NixOS/nixpkgs

**This is SixOS's biggest practical challenge.**

- SixOS uses `nixpkgs/pkgs` for its package set, so the *source definitions* are compatible
- However, many packages in nixpkgs link against `libsystemd` or assume systemd at build time
- These packages must be **rebuilt without systemd**, creating a **massive binary incompatibility** with the NixOS binary cache (cache.nixos.org)
- You cannot use NixOS's pre-built binaries -- you must compile from source or use a SixOS-specific cache (which doesn't exist at scale yet)
- Community notes this rebuild is "mostly painless" because BSDs, Gentoo, and Void Linux act as a "firewall" ensuring packages build without systemd
- But compilation time for a full system is substantial

### 1.5 Known Issues / Limitations

1. **No binary cache** -- must compile everything locally or set up your own cache
2. **Solo maintainer** -- bus factor of 1
3. **Limited documentation** -- talk slides and demo repo are primary docs
4. **Home Manager integration** -- unclear/untested
5. **Desktop environment support** -- claimed but not well-documented
6. **udev dependency** -- some packages need udev (part of systemd project); compromise approaches discussed but not resolved
7. **Small community** -- limited troubleshooting resources

### 1.6 Other NixOS Forks / Efforts to Remove systemd

| Project | Status | Notes |
|---------|--------|-------|
| **SixOS** | Active (2025) | The most mature effort. Uses s6. |
| **not-os** | Historical/niche | NixOS-based, designed for embedded systems. Minimal, not desktop-oriented. |
| **nixos-init-freedom** | Experimental | [sr.ht/~guido/nixos-init-freedom](https://sr.ht/~guido/nixos-init-freedom/) -- uses s6 within NixOS rather than replacing the module system |
| **Upstream NixOS restructuring** | Discussed, not implemented | Multiple NixOS Discourse threads (2022-2025) discuss restructuring NixOS to support alternative init systems. Core challenge: NixOS modules are deeply coupled to systemd for activation scripts and service management. No concrete progress. |
| **nixpkgs issue #24346** | Open since 2017 | "Can I replace systemd with OpenRC or runit on NixOS?" -- still open, no resolution |

**Bottom line:** SixOS is the only actively developed, somewhat-usable systemd-free Nix-based OS as of March 2026.

---

## 2. Nix Package Manager as Overlay (on Non-NixOS Distros)

### 2.1 How Well Does Nix Work on Non-NixOS?

**Generally well, with caveats.**

Nix installs everything into `/nix/store` with unique hashes per package. This means:
- **Zero conflicts** with the host package manager (apt, xbps, apk, pacman)
- Multiple versions of the same software coexist without issue
- The host system's `/usr`, `/lib`, etc. are completely untouched

**On systemd-free distros specifically:**
- The `nix-daemon` (multi-user mode) needs a service definition for your init system
- The official Nix installer provides systemd unit files but **not** runit/OpenRC/s6 service files
- This is a packaging gap, not a technical limitation -- `nix-daemon` runs fine under any service manager
- On macOS it uses `launchd`, proving init-system flexibility

**Installation paths:**
- **Void Linux:** Nix available in repos but **severely outdated** (2+ years behind as of 2025). Use the official single-user installer instead.
- **Artix Linux:** Nix available in repos, pre-configured for your chosen init system (OpenRC/runit/s6/dinit)
- **Alpine Linux:** Multi-user installer fails (no systemd). Manual nix-daemon OpenRC service setup required. Single-user mode works directly.

### 2.2 What Breaks Without systemd?

**Things that work fine:**
- Package installation and management
- Development shells (`nix develop`, `nix-shell`)
- Building packages from source
- Home Manager (standalone mode)
- Flakes
- Binary cache downloads

**Things that break or need workarounds:**
- **NixOS-style service management** -- `services.nginx.enable = true` style options don't exist outside NixOS. You must manage services with your host's init system.
- **Packages that assume systemd at runtime** -- Some packages (particularly desktop environment components) use `libsystemd` for:
  - logind (session management)
  - D-Bus activation
  - Journal logging
  - Socket activation
- **Graphical applications** -- Need `nixGL` or `nix-system-graphics` to work properly on non-NixOS (OpenGL/Vulkan driver mismatch between Nix packages and host system)
- **Hardcoded systemd paths** -- Some packages have hardcoded paths to systemd utilities

### 2.3 Declarative Configuration Without NixOS

**Yes, via Home Manager (standalone mode).**

Home Manager provides declarative, NixOS-style configuration for your user environment:
- Manages dotfiles, shell configs, editor configs
- Installs user-scoped packages
- Works on **any Linux distro** and **macOS**
- Configuration lives in `~/.config/home-manager/home.nix`
- `targets.genericLinux.enable = true` fixes common non-NixOS issues (XDG_DATA_DIRS, locale, etc.)
- Supports flakes for reproducibility

**What Home Manager covers:**
- Shell (fish, zsh, bash)
- Git config
- Editor configs (neovim, vim, emacs, VSCode)
- Terminal emulators
- CLI tools and their configs
- Environment variables
- Systemd user services (on systemd hosts) -- [UNCERTAINTY] unclear how well this works on non-systemd hosts

**What Home Manager does NOT cover:**
- System-level packages (kernel, bootloader, networking)
- Init system configuration
- System services
- Hardware configuration

**For system-level declarative config on non-NixOS:** There is no direct equivalent. You'd need to combine Nix/Home Manager with your distro's tools (or Ansible for system-level config).

### 2.4 Nix Flakes Maturity

**Flakes are functionally production-ready despite the "experimental" label.**

- Available since November 2021
- Widely used in production across the Nix community
- The "experimental" flag means the CLI interface *could* change, not that flakes are unstable
- Determinate Systems (major Nix company) considers them stable and ships "Stable Flakes" in their Nix distribution
- GitHub evidence shows massive community adoption

**Key flakes features:**
- `flake.lock` -- pinned, reproducible dependency resolution
- `nix develop` -- reproducible dev shells
- `nix build` -- hermetic builds
- Composable inputs system

**Risks:**
- CLI syntax could change (minor disruption)
- Upstream Nix vs Determinate Nix divergence -- Determinate is dropping upstream Nix from their installer in favor of their own fork with added features (lazy trees, parallel evaluation)
- [UNCERTAINTY] Whether upstream Nix and Determinate Nix will reconverge or permanently fork is unclear as of 2026

### 2.5 Nix vs Host Package Manager Interaction

**No conflicts by design.** Nix's `/nix/store` architecture means:
- Nix packages are completely isolated from system packages
- Both can be on `$PATH` simultaneously (Nix prepends its paths)
- No shared library conflicts
- You can have system Python 3.11 AND Nix Python 3.12 without issues
- Nix packages are self-contained -- they don't use system libraries

**The only friction point:** If both install the same binary name, `$PATH` ordering determines which runs. `nix-env` / Home Manager typically prepend to `$PATH`, so Nix versions take precedence.

### 2.6 Can Nix Manage Specific Toolchains?

| Tool | Nix Support | Notes |
|------|-------------|-------|
| **Bun** | Yes | Available in nixpkgs. `pkgs.bun` |
| **Node.js** | Excellent | Multiple versions available. `pkgs.nodejs_20`, `pkgs.nodejs_22`, etc. |
| **Python** | Excellent | Full version matrix. `pkgs.python311`, `pkgs.python312`. Virtualenv integration. |
| **Rust** | Excellent | Via nixpkgs or `rust-overlay` / `fenix` for nightly/specific versions |
| **Fish shell** | Yes | `pkgs.fish`. Home Manager has `programs.fish` module for full config. |
| **KDE Plasma** | Yes (NixOS) / Partial (non-NixOS) | `plasma-manager` exists for Home Manager. On non-NixOS, Plasma itself should be installed via host package manager; plasma-manager can configure settings declaratively. |
| **Developer tools** | Excellent | git, ripgrep, fd, jq, direnv, etc. all available |

**Per-project dev environments are a major strength:**
```nix
# flake.nix devShell example
devShells.default = pkgs.mkShell {
  packages = [ pkgs.bun pkgs.nodejs_22 pkgs.python312 pkgs.rustup pkgs.fish ];
};
```

### 2.7 Cross-Platform: Linux + macOS

**Yes -- this is one of Nix's strongest features.**

- **nix-darwin** provides NixOS-like declarative system config for macOS (including Apple Silicon / M-series)
- **Home Manager** works identically on Linux and macOS
- A single flake can define configurations for both platforms:
  ```
  flake.nix
  ├── common/        # Shared: shell, editor, CLI tools
  ├── linux/         # Linux-specific
  └── darwin/        # macOS-specific (nix-darwin modules)
  ```
- Platform conditionals: `pkgs.stdenv.isDarwin` / `pkgs.stdenv.isLinux`
- Same `flake.lock` = same dependency versions on both platforms
- [UNCERTAINTY] Some packages are Linux-only or have different behavior on macOS. The *configuration* is shared; not every *package* builds on both.

**For MacBook Pro M5 Max specifically:**
- nix-darwin supports `aarch64-darwin` (Apple Silicon) natively
- Rosetta not needed for Nix itself
- Most nixpkgs packages build for `aarch64-darwin`
- Linux binaries can be built on macOS via a background NixOS VM (nix-darwin module)

---

## 3. The Nix + Non-systemd Combination

### 3.1 Best Base Distro for Nix Overlay

| Distro | Init System | Nix Support | Desktop/Gaming | Verdict |
|--------|-------------|-------------|----------------|---------|
| **Void Linux** | runit | Good, but distro Nix package outdated. Use official installer. | Solid desktop support, good gaming community | **Best overall balance** for daily driver + Nix overlay. Rolling release, active community, good hardware support. |
| **Artix Linux** | OpenRC/runit/s6/dinit (choice) | Good. Nix in repos, pre-configured for chosen init. | Excellent -- Arch packages + AUR access | **Best for gaming/desktop** due to Arch ecosystem. Multiple init choices. |
| **Alpine Linux** | OpenRC | Requires manual setup. Multi-user installer fails. | Limited desktop support. Musl libc causes compatibility issues. | **Best for servers/containers**, not desktop. Musl libc breaks many Nix packages that assume glibc. |

**Recommendation for sovereign desktop computing: Artix or Void.**

- Artix gives you Arch's massive package ecosystem as a fallback
- Void gives you a truly independent distro with excellent engineering (xbps is fast, runit is simple)
- Both have active communities and good hardware support
- Both support the common desktop stacks (KDE, GNOME, etc.)

### 3.2 Known Issues with Nix on Each

**Void Linux:**
- Distro-packaged Nix is very outdated -- use official installer
- runit service file for nix-daemon must be written manually (trivial)
- `glibc` based, so Nix binary cache works perfectly

**Artix Linux:**
- Service files for nix-daemon may need manual creation depending on init system chosen
- Arch-based, `glibc`, so binary cache compatibility is excellent
- AUR + Nix gives maximum package coverage

**Alpine Linux:**
- **Musl libc** is a major issue -- Nix binary cache is built for glibc. Many packages need recompilation or won't work.
- Multi-user Nix installer doesn't work (no systemd). Manual daemon setup required.
- Limited graphical stack
- [UNCERTAINTY] nixpkgs has some musl support (`pkgsMusl`) but it's not comprehensive

### 3.3 Does Nix's Service Management Require systemd?

**No.** The Nix package manager itself has zero systemd dependency. However:

- The `nix-daemon` needs to be managed by *some* service manager. It's a simple long-running process -- any init system works.
- `home-manager` can generate systemd user services if on a systemd host, but this feature simply doesn't activate on non-systemd hosts
- NixOS module `services.*` options are NixOS-specific and do assume systemd. These are **not available** when using Nix as an overlay.
- For service management on a non-systemd host, you use the host's native init system (runit, OpenRC, s6, etc.)

---

## 4. Reproducibility / Unified Installer Vision

### 4.1 Nix for "One Config, Identical Environments"

**Nix flakes are the closest thing to this vision that exists today.**

A single `flake.nix` can define:
- Development shells with pinned tool versions
- System configurations for multiple machines
- User environment configurations via Home Manager
- Build outputs (packages, containers, VM images)

The `flake.lock` file pins every input to an exact git revision, ensuring bit-for-bit reproducible resolution.

**What a Nix flake CAN define:**
- Shell environment (fish with plugins, starship prompt, aliases)
- Dev tools (bun, node, python, rust, etc. -- pinned versions)
- System packages (on NixOS or via nix-darwin on macOS)
- Dotfiles (via Home Manager)
- Editor configuration (neovim plugins, VSCode extensions)
- Git config, SSH config
- Per-project dev environments (via `devShells`)

**What it CANNOT define (without NixOS/nix-darwin):**
- Kernel configuration
- Bootloader
- Init system / service management
- System-level networking
- Hardware configuration
- Filesystem layout

### 4.2 Comparison with Alternatives

| Feature | Nix Flakes | Ansible | GNU Guix |
|---------|-----------|---------|----------|
| **Reproducibility** | Excellent -- hermetic builds, pinned deps | Poor -- convergent, not reproducible. Same playbook can produce different results. | Excellent -- aims for bit-for-bit reproducibility |
| **Declarative** | Yes -- functional language | Partially -- YAML playbooks are declarative-ish but execution is imperative | Yes -- Guile Scheme |
| **Dev environments** | Excellent -- `nix develop` | Not designed for this | Good -- `guix shell` |
| **Cross-platform** | Linux + macOS | Any SSH target | Linux only |
| **Package count** | ~100,000+ in nixpkgs | N/A (uses system packages) | ~30,000 (smaller, free-software-only) |
| **Learning curve** | Steep (Nix language) | Moderate (YAML + modules) | Steep (Guile Scheme) |
| **System management** | Full (NixOS) or partial (overlay) | Full (any system) | Full (Guix System) |
| **Rollback** | Yes -- generations | Manual (if you track state) | Yes -- generations |
| **Systemd dependency** | NixOS requires it; Nix overlay does not | No | Guix System uses GNU Shepherd (no systemd) |
| **Non-free software** | Supported (with `allowUnfree`) | N/A | Officially excluded (channels for non-free exist) |

**For the sovereign computing vision:**
- **Nix** is the pragmatic choice: largest ecosystem, cross-platform, works as overlay
- **Guix** is the philosophically purest choice: no systemd (uses Shepherd), reproducibility-focused, FSF-aligned -- but smaller ecosystem and Linux-only
- **Ansible** is complementary, not competing: use it for system-level provisioning that Nix-as-overlay can't reach

### 4.3 Practical Architecture Recommendation

For a "unified installer" across Linux desktop (systemd-free) and macOS:

```
flake.nix (single source of truth)
├── home/                    # Home Manager config (shared)
│   ├── shell.nix           # fish, starship, aliases
│   ├── dev.nix             # bun, node, python, rust
│   ├── editors.nix         # neovim config
│   └── git.nix             # git config
├── hosts/
│   ├── linux-desktop.nix   # Artix/Void specific (if any)
│   └── macbook.nix         # nix-darwin config for M5 Max
├── devShells/              # Per-project dev environments
└── flake.lock              # Pinned versions
```

**What this gives you:**
- `home-manager switch` on any machine applies identical user environment
- `nix develop` in any project gives identical dev shell
- `flake.lock` ensures version parity
- Platform-specific code isolated to `hosts/`

**What you still need the host distro for:**
- Kernel, bootloader, init system
- Hardware drivers (GPU, WiFi)
- Desktop environment (KDE Plasma) -- install via host, configure via plasma-manager
- System services (NetworkManager, audio, etc.)

---

## 5. Uncertainty Register

| Claim | Confidence | Reason |
|-------|-----------|--------|
| SixOS uses s6 init system | HIGH | Confirmed by multiple sources, project README, 38C3 talk |
| SixOS is maintained by Adam Joseph | HIGH | Codeberg repo, NixOS Discourse, 38C3 presentation |
| SixOS cannot use NixOS binary cache | HIGH | Architectural necessity -- different build inputs |
| SixOS supports gaming | LOW | No information found. Likely not viable given binary cache and Steam/systemd issues. |
| Nix flakes are production-ready | HIGH | Widespread adoption, Determinate Systems backing, years of production use |
| Nix works on Void/Artix without issues | MEDIUM | Confirmed working, but manual service setup needed. "Without issues" overstates it. |
| Nix works on Alpine | MEDIUM | Works but musl libc causes significant compatibility issues with binary cache |
| Home Manager works on non-systemd hosts | MEDIUM | Standalone mode confirmed working. systemd user services feature won't activate. Other features should work but less tested. |
| Same Nix config works on Linux and macOS | HIGH | Confirmed by nix-darwin + Home Manager. Some packages are platform-specific. |
| Determinate Nix and upstream Nix will diverge | MEDIUM | Determinate dropping upstream from installer (2026). Direction unclear. |
| Guix is a viable alternative for sovereign computing | MEDIUM | Technically capable but much smaller ecosystem. Linux-only is a limitation for macOS users. |
| KDE Plasma manageable via Nix on non-NixOS | LOW-MEDIUM | plasma-manager exists but primarily tested on NixOS. Non-NixOS use less documented. |

---

## Sources

- [SixOS Repository - Codeberg](https://codeberg.org/amjoseph/sixos)
- [SixOS NixOS Discourse Announcement](https://discourse.nixos.org/t/sixos-a-nix-os-without-systemd/58141)
- [SixOS 38C3 Talk](https://media.ccc.de/v/38c3-sixos-a-nix-os-without-systemd)
- [SixOS Lobsters Discussion](https://lobste.rs/s/kgqpqy/sixos_nix_os_without_systemd)
- [SixOS Hacker News Discussion](https://news.ycombinator.com/item?id=42884727)
- [Nix Flakes Explained - Determinate Systems](https://determinate.systems/blog/nix-flakes-explained/)
- [Experimental Does Not Mean Unstable - Determinate Systems](https://determinate.systems/blog/experimental-does-not-mean-unstable/)
- [Determinate Dropping Upstream Nix](https://determinate.systems/blog/installer-dropping-upstream/)
- [Home Manager Manual](https://nix-community.github.io/home-manager/)
- [Home Manager GitHub](https://github.com/nix-community/home-manager)
- [nix-darwin GitHub](https://github.com/nix-darwin/nix-darwin)
- [plasma-manager GitHub](https://github.com/nix-community/plasma-manager)
- [Install nix-daemon on non-systemd init - NixOS Discourse](https://discourse.nixos.org/t/install-nix-daemon-on-non-systemd-init/7911)
- [NixOS nixpkgs #24346 - Replace systemd](https://github.com/NixOS/nixpkgs/issues/24346)
- [Restructuring NixOS Without systemd - NixOS Discourse](https://discourse.nixos.org/t/restructuring-nixos-to-work-without-systemd-e-g-with-sysvinit/21298)
- [nixos-init-freedom - SourceHut](https://sr.ht/~guido/nixos-init-freedom/)
- [Nix on Alpine - GitHub Gist](https://gist.github.com/danmack/b76ef257e0fd9dda906b4c860f94a591)
- [NixOS SC Election 2024 - Flake Stabilization](https://github.com/NixOS/SC-election-2024/issues/112)
- [Nix on Other Distros' Package Managers](https://voidcruiser.nl/rambles/nix-on-other-distros-packagemanagers/)
- [Nix vs GNU Guix - Slant](https://www.slant.co/versus/1143/1145/~nix_vs_gnu-guix)
- [Guix vs Nix - Abilian](https://lab.abilian.com/Tech/Linux/Packaging/Guix%20vs.%20Nix/)
