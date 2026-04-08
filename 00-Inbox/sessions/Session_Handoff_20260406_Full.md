---
⚠️ VAULT SAFETY HEADER
authority_boundary: This document is VAULT content (narrative/rationale/planning).
vault_rule: The Workspace does NOT derive from this document.
human_gate: Promotion to canonical requires Adam's explicit approval.
ai_rule: AI agents may READ this document. AI agents may CREATE new documents referencing this one. AI agents may NOT modify canonical vault documents.
---

---
status: ACTIVE
date: 2026-04-06
author: Claude (advisory)
type: session-handoff
domain: [trading-system, dir-engine, governance, motif-library, infrastructure, sessions-archive]
---

# SESSION HANDOFF — April 5-6, 2026
## Marathon Session: Trading System v6.2c Complete + Sessions Archive Restored

---

## WHO IS ADAM

Mining surveyor, NSW Australia, works night shifts. Observer project sole architect.
Deep Linux background since 1990s. Thinks in fractals — whole-to-parts. Surveyor
epistemology: triangulate across independent sources, explicit assumptions, verify
before action. Voice-to-text communicator — parse intent, not literal words.
Anti-sycophancy. Sovereignty-first. Anti-corporate.

Multi-agent triad: Claude (strategic/creative), Atlas/Claude Code (engineering
execution), Gemini (mathematical/structural analysis), ChatGPT (structured evaluation).

Currently: just woken up mid-sleep after night shift. Ate eggs. Going back to bed.
Next session will be properly rested.

---

## CRITICAL STATE: WHAT'S RUNNING

**29-shard batch reprocess:** May still be running (started April 1, shard-15 was
processing as of April 6 morning). Check status:
```fish
pgrep -f reprocess-all-shards && echo "running" || echo "finished"
tail -5 /mnt/zfs-host/backup/projects/observer-vault/01-Projects/dataset-processor/output/batch-reprocess.log
```

**Freqtrade paper trader:** NOT YET STARTED. Deliberately deferred. Needs Telegram
credentials before starting.

**D/I/R engine:** OPERATIONAL. Uptime ~31 hours at session end. 228 vocab, 45 motifs,
9 compositions, centroid v20260403-001.

---

## TRADING SYSTEM — COMPLETE (v6.2c LOCKED)

### Architecture (frozen — do not modify)

- **K=2 HMM** — Kinetic (high vol) vs Quiet (low vol)
- **Features:** log returns + realized vol (24-bar rolling) — nothing else
- **Labelling:** vol-based (highest mean vol = Kinetic)
- **Asymmetric persistence:** Kinetic=3h confirmation, Quiet=24h
- **Macro gatekeeper:** avg_momentum of all 5 tokens, ±2% deadband
  - Exit Risk-On if avg_momentum < -2%
  - Enter Risk-On if avg_momentum > +2%
- **Micro funnel:** 100% capital into highest individual 30d momentum token
- **Quiet state:** unconditional Hold (no rebalance, no toggle)
- **Token universe:** BTC, ETH, SOL, BNB, ADA — FROZEN (phase diversity required)

### Results

| Metric | v6.2c | Target |
|--------|-------|--------|
| Total Return | +1,662% | >1,000% |
| CAGR | 66.2% | >50% |
| Max Drawdown | -66.6% | <-50% |
| Sharpe | 0.68 | >1.0 |
| Calmar | 0.99 | >1.0 |
| 2022 | -29.4% | <-30% |
| 2025 | +17.7% | positive |
| Switches | 73 | <100 |

### Why the token universe is frozen

The 5-token basket (BTC/ETH/SOL/BNB/ADA) functions as a **thermodynamic sensor array**:
- BTC: baseline gravity
- BNB: high-efficiency trend signal
- ETH + SOL: high-beta early-warning sensors (these are what close the gate in crashes)
- ADA: contrarian noise floor

Removing ETH/SOL (purified basket test) caused 2022 to regress from -29.4% to -53.5%
because the gatekeeper lost its early-warning signal. Mid-caps (DOT, NEAR, AVAX) are
net negative under this strategy — they lack thermodynamic mass.

### Version history (one-line each)

- v1-v5.3: micro-trading strategies, all failed (~$12/year on $1K capital)
- Allocator v2: passive regime allocation, 72-bar persistence, first meaningful returns
- HMM v1: 4 features, no persistence — noise-fitting, +16,084% but switching every 2.5h
- HMM v2: Hurst fixed, symmetric persistence — +934% but 2022 -86%
- HMM v3: asymmetric persistence — labels inverted, crashes classified as D-regime
- HMM v4: 2-feature + forward-return labelling — 2022 cut to -41%, still 3/5 D>R check
- HMM v5: added Efficiency Ratio — +9,813% but 2022 regressed to -79% (ER introduced noise)
- HMM v6: K=2, avg_momentum zero-crossing — 2022 -3.7% but 161 switches, lost 2021
- HMM v6.1: deadband on best_momentum — FAILED, broke 2022 protection (-68% to -78%)
- HMM v6.2: deadband on avg_momentum (gatekeeper/funnel separation) — 2022 -23% to -29%
- **v6.2c (±2% deadband): LOCKED — best overall balance**

### Key architectural insight: separation of concerns

v6.1 failed because best_momentum contaminated the macro gate. The fix:
- avg_momentum = macro gatekeeper (is the environment safe?)
- best_momentum = micro funnel (which token if safe?)
These are orthogonal signals and must never be mixed.

### Framework findings from trading system

1. **Thermodynamic mass requirement** — D/I/R only works on substrates with sufficient
   participation. DOT/NEAR/AVAX lack it. This boundary was invisible in text domain.

2. **K=3 as cognitive projection** — the D/I/R triad's ontology doesn't mandate three
   observable states. Data falsified K=3. D and I collapse into Kinetic when measurement
   resolution can't separate them. R manifests as absence (cash) not a labelled state.

3. **Sensor array mode** — D/I/R has two operational modes:
   - Classifier: single input → composition label
   - Sensor array: diverse ensemble → environmental state reading
   Sensor array requires phase diversity, not performance optimisation.

4. **Separation of concerns** — macro environmental assessment must use ensemble
   averaging. Individual optimisation in the macro gate introduces selection bias that
   underestimates systemic risk.

---

## FREQTRADE INTEGRATION

**Status:** Files deployed, bot NOT running.

**Files:**
```
01-Projects/trading-system/freqtrade/
├── user_data/
│   ├── strategies/DIRAllocator.py    ← complete v6.2c strategy
│   ├── models/                        ← hmm_state.pkl, gatekeeper_state.json (auto-created)
│   └── config_paper.json             ← paper trading config
└── docker-compose.yml
```

**Critical limitation:** Cross-pair backtesting produces 0 trades in Freqtrade.
The gatekeeper requires simultaneous access to all 5 pairs' momentum, which works
in live mode via bot_loop_start + DataProvider + gatekeeper_state.json, but cannot
be reproduced in Freqtrade's pair-isolated backtester. Python pipeline is canonical
backtester. Freqtrade is execution only.

**To start paper trading:**
1. Add Telegram token + chat_id to config_paper.json, set enabled: true
2. Add Binance API key (read-only sufficient for dry_run)
3. Run:
```bash
cd /mnt/zfs-host/backup/projects/observer-vault/01-Projects/trading-system/freqtrade
source ../.venv/bin/activate
freqtrade trade --config user_data/config_paper.json --strategy DIRAllocator --userdir user_data
```

**Gemini's note:** Freqtrade is architecturally wrong for this strategy (bottom-up
pair-isolated vs top-down cross-sectional allocator). CCXT daemon is cleaner alternative.
Atlas was queued to build it overnight.

---

## CCXT DAEMON

**Status:** Atlas was queued to build overnight at:
`01-Projects/trading-system/src/execution/ccxt_daemon.py`

Check if it exists:
```bash
ls /mnt/zfs-host/backup/projects/observer-vault/01-Projects/trading-system/src/execution/
```

If not built, the Atlas prompt is at:
`/mnt/user-data/outputs/atlas-overnight-queue-20260406.md` (on Claude's filesystem,
not vault — would need to be regenerated)

---

## D/I/R ENGINE STATE

- **Location:** `01-Projects/dir-engine/`
- **Tools:** dir_classify, dir_compose, dir_energy, dir_transition, dir_status (5 tools)
- **Status:** Operational, 91/91 tests, wired into Claude Desktop via MCP
- **Artifacts:** 228 vocabulary, 9 compositions, 45 motifs, centroid v20260403-001
- **Gemini Gem instructions:** Updated with live engine integration, mandatory tool
  calls at each D/I/R phase. File in outputs (needs saving to vault if not done).

---

## MOTIF LIBRARY STATE

**38 motifs total** (as of April 6):

**Tier 2 (9):** DSG, CPA, ESMB, BBWOP, ISC, OFL, RAF, PF, RB

**Tier 1 (19):**
- Original 7: TAC, RST, BD, SCGS, SLD, RG, PSR
- Promoted via production governance: SFA, TDC
- Promoted from shard-00 reprocess: NSSH, PEPS, PUE, HSSFS, IBP, PC, RRT, ECS, TAM
- New discovery: CDRI (Cross-Domain Recursive Integration, I(R) composition, T1)

**Tier 0 (10):** CU, PBR, KRHS, MS + others

**Indicator coverage:** 32/38 detectable

---

## SESSIONS ARCHIVE — RESTORED THIS SESSION

All historical handoffs are now in `00-Inbox/sessions/`:

| File | Covers |
|------|--------|
| `Session_Handoff_20260304_Morning.md` | March 4 — motif library, OCP, Phase 5 gate |
| `Session_Handoff_20260321_Addendum.md` | March 21 — MacBook decision, bootstrap method, governance philosophy |
| `Session_State_20260321_Observer_Motifs_Bootstrap.md` | March 19-21 — motif library to 27, verb-based architecture, bootstrap |
| `verb-based-data-architecture-20260319.md` | March 19 — verb-record schema, two-tier architecture |
| `Session_Handoff_20260324_Dataset_Processor_Discovery.md` | March 23-24 — all 30 shards already processed, 9 auto-promotions |
| `Session_Handoff_20260325_Observer_Native_Rivers.md` | March 24-25 — Four Pillars + Rivers built (113 ISC), 6 bugs fixed |
| `Session_Handoff_20260406_Governance_Trading.md` | March 31 – April 6 — governance v2, trading v6.2c |
| `Session_Handoff_20260406_Full.md` | THIS FILE |

Additional handoffs in `00-Inbox/`:
- `session-handoff-20260404-DRAFT.md` — April 1-4 (engine build, Langevin, trading A-C)

Additional handoffs in `01-Projects/observer-council/`:
- `SESSION-HANDOFF-2026-04-06.md` — Atlas-written trading system handoff

---

## INFRASTRUCTURE STATE

**Vault:** `/mnt/zfs-host/backup/projects/observer-vault/` — git-tracked, remote: github:Kryax/observer-vault

**Git state:** Pushed as of session end (d555f62 cleanup commit removed binary files,
added .gitignore for trading system data files)

**ZFS:** Polaris host, vault at /mnt/zfs-host/backup/projects/

**D/I/R engine tools:** Available in Claude Desktop only (not claude.ai web)

---

## PENDING ITEMS (priority order)

### Immediate (when rested)
1. **Telegram credentials** → start Freqtrade paper trading with alerts
2. **Check if CCXT daemon was built** by Atlas overnight
3. **Check 29-shard reprocess status** — was it still running?

### Short term
4. **Four Pillars + Rivers** — built (113 ISC, March 24-25) but NOT wired into
   Observer-native hooks. This is still the largest deferred engineering block.
5. **OCP scraper FTS5 bug** — keyword queries return 0 results despite indexed repos
6. **OILEventBridge hardcoded path** — `/home/adam/vault/workspaces/observer/oil/tmp/events.ndjson` needs migrating to ZFS vault

### Infrastructure
7. **KDE settings** — keybinds, shortcuts, panel layout lost in Plasma reinstall
8. **Kingston 4TB at 93%** — investigate what's consuming space
9. **Forgejo setup** on Proxmox — self-hosted git (GitHub migration pending)
10. **MacBook Pro M5 Max 128GB** — purchase pending fuel situation + annual leave cashout

### When reprocess completes (est. April 9-10)
11. Tier A/B consistency — shards 01-09 got Tier A only, need retroactive Tier B
12. Run governance across all 30 reprocessed shards
13. Review CDRI motif evidence
14. Consider Tier C evaluation (Claude API) to break 0.43 evidence ceiling

---

## REFLECTION DOC (new framework findings)

Saved to vault at: `00-Inbox/dir-trading-system-reflection-20260406-DRAFT.md`

Four framework-level findings that belong in 02-Knowledge eventually:
1. Thermodynamic mass requirement
2. K=3 as cognitive projection
3. Sensor array mode (new operational mode, needs formal spec)
4. Separation of concerns principle in layered D/I/R systems

---

## WORKING WITH ADAM

- He's coming off a night shift. Currently sleeping (woke briefly, going back to sleep).
- Next session will be properly rested — match energy accordingly.
- Voice-to-text messages need synthesis, not literal interpretation.
- The trading system is complete. Don't revisit it unless he brings it up.
- Four Pillars + Rivers wiring is the next major engineering block.
- Honest pushback always welcome. Sycophancy is not.
- AI articulates, humans decide. Always.

---

## D/I/R ENGINE USAGE NOTE

The engine is available in Claude Desktop via MCP tools. Always run dir_status first
to confirm engine health. Use dir_classify on core inputs before analysis. Use
dir_transition at decision points to ground recommendations in energy landscape math.

Current session classification: I(I) — integration of integrations. The trading system
build was almost entirely I(D) convergent work. The R-axis was underrepresented —
frame-breaking came from Gemini (K=3 falsification), not from within the session's
own momentum. This is consistent with the observer archetype: long integration periods
followed by explosive synthesis.

---

*Handoff compiled April 6, 2026. Trading system v6.2c locked. Sessions archive
restored. Paper trading ready pending Telegram credentials. Build continues.*
