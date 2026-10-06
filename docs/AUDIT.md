# Milo Code Audit — 2026-10-07

This audit reviewed the current M0–M6 code paths for:
- unbounded loops and missing timeouts
- task cancellation / replacement races
- project progress accounting
- memory persistence races
- furnace fuel handling
- image-analysis hangs
- build-site safety calculations
- dry-run / rollback invariants

## Fixed in this audit
- Bound the resource-gathering loop so missing item pickup cannot loop indefinitely.
- Added task ownership so cancelled/replaced tasks cannot clear or overwrite newer tasks.
- Preserved verified project progress when syncing build materials.
- Reopened projects when new material deficits are introduced.
- Only count storage-verified deltas as delivered project materials.
- Resume non-project partial storage tasks using only the verified remainder.
- Reuse already-loaded furnace fuel before requiring more inventory fuel.
- Add a timeout to HTTP vision analysis.
- Serialize and atomically replace memory JSON writes.
- Recover the memory save queue after a failed write.
- Measure actual terrain variance in site preflight.
- Added regression coverage for the new audit fixes.
- Added GitHub Actions CI for npm tests and src/index.js syntax checking.

## Still requires live-world validation
Mineflayer runtime APIs and behavior still need verification on a real Minecraft Java server:
- pathfinder behavior and failure modes
- dropped-item pickup timing after dig
- container APIs
- furnace APIs
- consume/eating behavior
- entity flags for water/lava/fire
- death recovery
- real-world dry-run/site-preflight observations

Permanent block placement remains disabled.
