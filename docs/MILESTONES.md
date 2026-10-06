# Milo Milestones

## M0 — Presence
- [x] Repository foundation
- [x] Minecraft connection scaffold
- [x] Pathfinder integration
- [x] Owner pairing
- [x] Persistent local memory
- [x] Remember/return home
- [ ] Smoke test against a real Java server

## M1 — Resource Runner
- [x] Parse "get me N <resource>"
- [x] Inventory introspection
- [x] Tool requirement resolver
- [x] Basic food/survival check
- [x] Block/resource locator
- [x] Mining skill
- [x] Return-to-home flow
- [x] Remember storage chest/barrel
- [x] Deposit exact requested amount
- [x] Event log and completion report
- [ ] Real-server integration test and fixes

> M1 code is implemented but not considered reliable until tested against a live Java world. Smelting is intentionally deferred to M2.

## M2 — Craft + Smelt
- [x] Craft missing tools with mining-tier requirements
- [x] Furnace discovery
- [x] Craft/place furnace when none exists
- [x] Multi-fuel selection
- [x] Smelting job pipeline
- [x] Distinguish raw ore vs ingot intent
- [ ] Live-world crafting/furnace integration test

## M3 — Reliable Teammate
- [x] Goal verification with storage/inventory state deltas
- [x] General replanning — bounded retries, directional search, alternate target selection, tool replacement, and gather replan implemented
- [x] Death-location memory + inventory-verified item recovery
- [x] Hazard policies — auto-eating, health/hunger, adjacent lava/fire, drowning/fire-state, and nearby-hostile checks implemented
- [x] Task cancellation
- [x] Player interruption — stop/cancel, persistent resume, urgent come/help preemption, and true task replacement
- [ ] Live-world M3 integration test

## M4 — Shared Projects
- [x] Persistent named projects
- [x] Material bill
- [x] Progress tracking from verified deliveries
- [x] "continue project" dispatches the largest material deficit to Resource Runner
- [~] Collaborative task suggestions — next-material bottleneck selection implemented

## M5 — Image-to-Build
- [x] reference-image pipeline contract + URL ingestion + pluggable HTTP vision analysis + observation-to-plan adapter
- [x] editable weighted block-palette planning + analyzer-supplied image palette support
- [x] footprint/height planning model, revision/approval, and non-destructive perimeter-walk preview
- [x] deterministic material estimate + richer foundation/walls/openings/roof geometry
- [ ] build executor — intentionally locked pending live-world verification
- [x] read-only plan-vs-world verification with mismatch reporting


## Next implementation batch
1. Run the live-world M0-M3 smoke test against a real Minecraft Java server.
2. Patch Mineflayer integration mismatches found in movement, digging, container, furnace, consume and entity APIs.
3. Re-run dry-run/site-preflight flows against the same live world.
4. Only after those pass, design the first permanently-disabled-by-default placement executor behind an explicit feature flag.
5. Keep rollback snapshots, protected zones and per-section approvals mandatory for any future placement.


## M6 — Execution Safety Design
- [x] Crafted-block dependency expansion for raw-resource accounting
- [x] Block-state/orientation metadata helpers
- [x] Plan diff + staged revision accept/reject workflow
- [x] Protected-zone model
- [x] Per-section approvals
- [x] Rollback snapshot metadata
- [x] Executor gate defaults to disabled
- [ ] Permanent block placement — intentionally disabled
- [x] Read-only dry-run executor with conflict classification
- [x] Section execution manifests with zero world mutation
- [ ] Live-world validation before any executor enablement
- [x] Terrain/site preflight
- [x] Door/slab/stair state helpers
- [x] Per-section inventory readiness
- [x] Rollback snapshot vs manifest preview
