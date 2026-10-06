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
1. Build a dry-run executor that simulates section placement without modifying the world.
2. Add conflict detection for protected zones, occupied blocks and unsupported placements.
3. Add exact orientation/state generation for stairs, doors and slabs across all structure sections.
4. Add rollback-preview and section-by-section execution manifests.
5. Run the live-world M0-M3 smoke test before any permanent placement can be enabled.


## M6 — Execution Safety Design
- [x] Crafted-block dependency expansion for raw-resource accounting
- [x] Block-state/orientation metadata helpers
- [x] Plan diff + staged revision accept/reject workflow
- [x] Protected-zone model
- [x] Per-section approvals
- [x] Rollback snapshot metadata
- [x] Executor gate defaults to disabled
- [ ] Permanent block placement — intentionally disabled
- [ ] Live-world validation before any executor enablement
