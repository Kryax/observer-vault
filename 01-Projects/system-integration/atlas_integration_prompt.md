Read the CLAUDE.md in this directory first. Then read System_Inventory_Complete.md for the full ecosystem map.

# Task: Create PRD and Execute System Integration

## Step 1: Create PRD

Create a PRD for Phases 1-3 of the system integration. Use the four-phase sequence from System_Inventory_Complete.md Section F as the basis, refined by the CLAUDE.md scope.

The PRD must:
- Break work into parallelisable slices where dependencies allow
- Include explicit ISC (Integration, Security, Completion) exit criteria for every slice
- Phase 1 slices can all run in parallel (no interdependencies)
- Phase 2 slices are sequential (each step depends on the previous)
- Phase 3 slices can partially parallelise after Phase 2 completes
- Include a verification slice at the end of each phase that confirms all prior slices pass

Save the PRD to this project directory.

## Step 2: Execute PRD

After the PRD is created and saved, execute it using fan-out loop mode.

- Use subagents for parallel slices
- Verify ISC criteria for each slice before moving to the next
- If any slice fails ISC, stop and report — do not continue
- Create a backup of any config file before modifying it
- After each phase completes, run a phase verification step

## Step 3: Report

After execution, produce a completion report showing:
- Every slice with pass/fail status
- Proof of work for each (test output, service status, config diff)
- Any issues encountered and how they were resolved
- Updated system state — what's now connected that wasn't before
- Remaining gaps (Phase 4 items, anything that couldn't be completed)

Save the report to this project directory.

## Critical Reminders

- Backup before modifying ~/.profile, settings.json, or any live config
- The control plane setup.sh may need sudo — if it does, document what it needs and ask Adam rather than running it blindly
- The ElevenLabs key move is security-sensitive — verify the new location works before removing the old one
- After wiring OIL hooks, verify they trigger correctly on a test commit
- The control plane's target directory is /opt/observer-system/ which doesn't exist yet — setup.sh should create it

Go.
