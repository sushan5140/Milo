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
- [~] General replanning — bounded retries, directional search, tool replacement, and gather replan implemented
- [x] Death-location memory + inventory-verified item recovery
- [~] Hazard policies — auto-eating plus health/hunger and adjacent lava/fire guards implemented
- [x] Task cancellation
- [x] Player interruption — stop/cancel, persistent resume, and urgent come/help preemption implemented

## M4 — Shared Projects
- [ ] Persistent named projects
- [ ] Material bill
- [ ] Progress tracking
- [ ] "continue project"
- [ ] collaborative task suggestions

## M5 — Image-to-Build
- [ ] reference-image interpretation
- [ ] block-palette proposal
- [ ] footprint preview
- [ ] materials plan
- [ ] build executor
- [ ] visual/world-state verification


## Next implementation batch
1. Add unreachable-goal recovery with alternative candidate selection rather than retrying the same target.
2. Add stronger danger policies for mobs, falls, drowning and fire exposure.
3. Add task replacement ("forget coal, get diamonds instead") distinct from temporary preemption.
4. Run the documented live-world smoke test and patch integration failures.
5. Begin M4 project memory once M3 survives real gameplay.
