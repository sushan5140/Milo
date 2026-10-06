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
- [ ] Goal verification
- [ ] General replanning
- [x] Death-location memory + explicit item recovery
- [~] Hazard policies — health/hunger and adjacent lava/fire guards implemented
- [x] Task cancellation
- [~] Player interruption — stop/cancel implemented; task replacement/resume still pending

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
1. Goal verifier: compare requested outcome with actual inventory/storage/world state.
2. Retry/replan policy for path failures, missing blocks, broken tools and busy furnaces.
3. Resume interrupted tasks rather than discarding them.
4. Better death recovery verification (compare recovered inventory snapshot).
5. First live-world smoke-test checklist and diagnostics.
