# Storage Safety D/I/R Analysis — 2026-03-25

> SQLite corruption on NFS/ZFS: root cause analysis, storage topology mapping, and production-grade fix.

## Storage Topology

```
Machine: VM (vda 120G, vdb 2T)
├── / (btrfs, /dev/vda2, 116G, 53G used, LOCAL SSD)
├── /home (btrfs, same partition, LOCAL SSD)
├── /tmp (tmpfs, 12G RAM-backed)
├── /mnt/steam2 (ext4, /dev/vdb, 2TB, 676G used, LOCAL DISK)
└── /mnt/zfs-host (NFS4 → 192.168.68.10:/tank, ZFS on Proxmox)
    └── /backup/projects/observer-vault/  ← ALL DATABASES LIVE HERE
```

NFS mount options (critical):
```
vers=4.2, rsize=1048576, wsize=1048576, hard, proto=tcp,
timeo=600, retrans=2, local_lock=none
```

**`local_lock=none`** means all locking is delegated to the NFS server. No local POSIX lock enforcement.

## Pass 1 — DESCRIBE: What exactly caused the corruption?

### The five Database connections per pipeline run

Tracing every `new Database()` call for a single `orchestrate` invocation:

1. **Pipeline.db** — `pipeline.ts:482`: `new Database(config.dbPath)` — WAL mode, runs migrations, used by PriorityBuffer, GapScorer, MotifGraph, processing_state tracking
2. **VerbRecordStore.db** — `verb-record-store.ts:66`: `new Database(dbPath)` — WAL mode, runs migrations independently, used for verb_record inserts and FTS index
3. **Governance.db** — `governance/index.ts:51`: `new Database(config.dbPath)` — WAL mode, opened separately for each governance run
4. **scripts/diagnose.ts** — ad-hoc diagnostic queries (manual)
5. **scripts/ingest-candidates.ts** — bulk import (manual)

Connections 1 and 2 are **concurrent on the same database file** during pipeline execution. Both set `PRAGMA journal_mode=WAL` independently. Both run `runMigrations()` independently.

### What SQLite WAL requires

SQLite WAL mode uses two auxiliary files:
- **`-wal` file**: Append-only write log. All writes go here first.
- **`-shm` file**: Shared-memory index. Memory-mapped by all connections for reader coordination.

The `-shm` file uses `mmap()` for inter-process coordination. This requires:
1. **Coherent shared memory** — all processes see the same bytes at the same addresses
2. **Atomic page writes** — a write to the `-shm` file must be visible atomically to other readers
3. **Proper `fcntl` locking** — SQLite uses byte-range locks on the `-shm` file to coordinate readers and writers

### What NFS4 provides (and doesn't)

- **`flock()`**: Works (tested). But SQLite uses `fcntl()` byte-range locks, not `flock()`.
- **`fcntl()` byte-range locks**: Supported in NFS4 via the NFS lock manager, but with caveats:
  - Lock state is maintained on the NFS **server**. If the server restarts, lock state can be lost during the grace period.
  - Lock operations have network round-trip latency.
  - `local_lock=none` means the kernel doesn't cache locks locally — every lock operation hits the server.
- **`mmap()` coherence**: This is the critical failure point. NFS does NOT guarantee mmap coherence across clients. Even within a single client, NFS mmap semantics are "close-to-open" — changes are only guaranteed visible after `close()`/`open()` cycles, not via mmap page faults. SQLite's WAL `-shm` coordination **assumes POSIX mmap coherence** which NFS cannot provide.

### The corruption mechanism

SQLite's own documentation ([https://sqlite.org/wal.html](https://sqlite.org/wal.html)):

> **WAL mode does not work well on network filesystems.** There may be problems with two or more processes talking to the same WAL file on a network filesystem.

The specific failure mode for shard-01:

1. Pipeline opens DB, sets WAL mode. Creates `-shm` and `-wal` files on NFS.
2. Pipeline.db (connection 1) and VerbRecordStore.db (connection 2) both mmap the same `-shm` file.
3. Under write load, the `-shm` pages diverge between the two connections because NFS mmap doesn't guarantee coherent reads. Connection 2 writes records; connection 1 doesn't see them in the `-shm` index.
4. Checkpoint never runs (or runs with stale `-shm` state), so the `-wal` grows to 47MB without being folded back into the main database.
5. At some point — likely a network hiccup, NFS timeout, or process kill — the `-wal` was left in an inconsistent state relative to the main DB.
6. On next open, SQLite tries to replay the `-wal` but the btree pages it references are inconsistent with the main DB → `SQLITE_CORRUPT`.

### Why shard-00 survived and shard-01 didn't

Both ran under identical conditions. The difference is likely timing: shard-00 completed its run without hitting a network interruption, while shard-01 was processing when something happened (NFS timeout, ZFS scrub, server-side I/O pause). With WAL mode on NFS, corruption is probabilistic — every run is a dice roll.

### The git "unstable object source data" error

Same root cause, different symptom. Git's pack files and loose objects use `mmap()` + `fsync()` for consistency. Under concurrent writes (pipeline writing large DB files while git tries to read/hash them), NFS's close-to-open semantics mean git can see partially-written data for files it has open. The git error is literally git reading an object whose bytes changed mid-read because NFS served stale cached data.

---

## Pass 2 — INTEGRATE: What's the right storage strategy?

### Option A: journal_mode=DELETE on NFS

- Eliminates the `-shm` file entirely. Uses rollback journal instead.
- **Pro**: No mmap dependency. Rollback journal uses `fcntl` locks only, which NFS4 supports.
- **Con**: ~5x slower for write-heavy workloads (every transaction rewrites pages in the main DB file). The pipeline processes millions of documents — this matters.
- **Con**: Still vulnerable to NFS write reordering on crash. A partial `fsync` on NFS can corrupt the rollback journal.
- **Verdict**: Reduces risk but doesn't eliminate it. Not suitable for production.

### Option B: EXCLUSIVE locking mode

- `PRAGMA locking_mode=EXCLUSIVE` — one connection owns the DB, no shared access.
- **Pro**: Eliminates the multi-reader `-shm` coordination problem.
- **Con**: Only one process can use the DB at a time. The pipeline already opens TWO connections (Pipeline.db + VerbRecordStore.db), so this would deadlock.
- **Con**: Still uses WAL `-shm` for the single connection's internal state.
- **Verdict**: Would require restructuring to single connection. Partial solution.

### Option C: Local database, NFS export (recommended)

- Write databases to local storage (`/mnt/steam2`, ext4, 2TB, 1.2TB free).
- Export results (JSONL, digests, review packets) to NFS/ZFS for persistence.
- Copy final databases to NFS after pipeline completes (optional).
- **Pro**: Eliminates all NFS/SQLite interaction during writes. Local ext4 has proper mmap, fsync, and locking.
- **Pro**: 2TB local disk has ample space. Databases are 100MB-600MB each.
- **Con**: Databases are not on the ZFS snapshot schedule during processing.
- **Verdict**: This is what production systems do. Process locally, export to network storage.

### Option D: Single connection + EXCLUSIVE + WAL on NFS

- Restructure pipeline to pass a single Database connection everywhere.
- Set EXCLUSIVE locking.
- Checkpoint WAL after every batch.
- **Pro**: Fixes the multi-connection race.
- **Con**: Still fundamentally unsafe on NFS due to mmap semantics.
- **Verdict**: Better than current, but still playing Russian roulette with NFS mmap.

### The right answer: C + structural fix

Option C (local storage) eliminates the NFS/SQLite interaction entirely. Combined with a structural fix to use a single Database connection (eliminating the Pipeline.db + VerbRecordStore.db split), this becomes robust.

### How concurrent operations interact

```
Timeline of a pipeline run:

Pipeline starts
  → Opens Pipeline.db (WAL) on NFS           ← DANGEROUS
  → Opens VerbRecordStore.db (WAL) on NFS    ← DANGEROUS, same file
  → Processes millions of documents
  → Buffer writes via Pipeline.db
  → Store inserts via VerbRecordStore.db
  → Both connections compete for -shm mmap    ← CORRUPTION RISK
  → Pipeline saves state (sees stale data)    ← BUG (fixed in prior commit)

Git operations during pipeline run:
  → git reads object files via mmap on NFS    ← "unstable object" errors
  → git writes pack files via fsync on NFS    ← can corrupt if concurrent
```

---

## Pass 3 — RECURSE: Architecture vs configuration?

### This is an architecture problem

It's not a SQLite misconfiguration. SQLite is working exactly as documented — it explicitly warns against WAL on network filesystems. The architecture problem is:

1. **The database is on the wrong storage tier.** Hot databases (being actively written) belong on local storage. NFS/ZFS is for cold storage, archival, and sharing.

2. **Two connections to the same file is unnecessary.** The VerbRecordStore opens its own Database connection because it was designed as a standalone module (following the OCP scraper pattern). But in the pipeline context, it should share the pipeline's connection.

3. **No crash recovery.** The pipeline has no integrity check on startup, no WAL checkpoint on shutdown, and no detection of corrupt state files.

### What a production-grade version does

1. **Databases on local SSD/disk** — always. Network storage is for backups and exports.
2. **Single writer connection** — one Database connection passed to all subsystems.
3. **Explicit WAL checkpoint on shutdown** — `PRAGMA wal_checkpoint(TRUNCATE)` before close.
4. **Integrity check on startup** — `PRAGMA integrity_check` before processing (fast for small DBs, skip for large ones or add a flag).
5. **Atomic state files** — write to temp file, fsync, rename (atomic on local filesystem).
6. **Export-on-complete** — copy database to NFS after pipeline finishes and verifies integrity.

### Minimum fix vs right fix

**Minimum fix** (implement now):
1. Default database path to local storage (`/mnt/steam2/dataset-processor/`)
2. Single Database connection shared across pipeline and store
3. `PRAGMA wal_checkpoint(TRUNCATE)` on shutdown
4. `PRAGMA integrity_check` on startup (with `--skip-integrity` flag for large DBs)
5. Atomic state file writes (write-to-temp + rename)

**Right fix** (future):
1. Export pipeline that copies verified databases to NFS after completion
2. Backup/snapshot integration with ZFS
3. Process-level lock file to prevent concurrent pipeline runs on same DB
4. Structured logging for all database lifecycle events

### Why single connection matters

Currently:
```
Pipeline.db  ──┬── priority_buffer table
               ├── processing_state table
               ├── motif_graph_edges table
               └── verb_records (reads only, sees stale WAL)

Store.db     ──┬── verb_records (writes + FTS)
               └── (opens its own WAL, runs its own migrations)
```

Both connections set `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON` independently. Both call `runMigrations()`. The VerbRecordStore's writes to `verb_records` are invisible to Pipeline.db until a WAL checkpoint occurs — which is why `getVerbRecordCount()` always returned 0.

After fix:
```
Pipeline.db  ──┬── ALL tables
               ├── VerbRecordStore (uses Pipeline.db, no own connection)
               ├── PriorityBuffer (already uses Pipeline.db)
               ├── GapScorer (already uses Pipeline.db)
               └── MotifGraph (already uses Pipeline.db)
```

---

## Fixes Applied

### Fix 1: VerbRecordStore accepts external Database connection

Add constructor overload that accepts an existing Database connection instead of opening its own. The pipeline passes its connection; standalone usage (governance, scripts) still opens a fresh connection.

### Fix 2: Pipeline uses single Database connection

Pass `this.db` to VerbRecordStore instead of `this.config.dbPath`. Eliminates the dual-connection WAL race.

### Fix 3: WAL checkpoint on shutdown

`PRAGMA wal_checkpoint(TRUNCATE)` in `shutdownSubsystems()` — folds all WAL data back into the main DB and truncates the WAL file to zero bytes. This means the database is self-contained after shutdown (no dangling `-wal`/`-shm` files).

### Fix 4: Integrity check on startup

`PRAGMA integrity_check` runs before processing. Fails fast if the database is corrupt rather than silently writing to a broken file.

### Fix 5: Default database path to local storage

The `orchestrate` command defaults `--db` to `/mnt/steam2/dataset-processor/output/shard.db` instead of `./output/shard.db`. This puts hot databases on local ext4 by default.

### Fix 6: Atomic state file writes

`savePipelineState()` writes to a `.tmp` file then renames — atomic on local filesystems, safe on NFS (rename is atomic per NFS spec).

---

## Verification

After applying fixes:
- shard-00.db: `PRAGMA integrity_check` → OK
- shard-02.db: `PRAGMA integrity_check` → OK
- shard-01: already deleted (corrupt beyond recovery)
- `tsc --strict`: passes
