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
- [ ] Craft missing tools
- [~] Furnace discovery/placement — discovery implemented, placement still pending
- [x] Fuel selection for coal/charcoal
- [x] Smelting job pipeline using an existing furnace
- [x] Distinguish raw ore vs ingot intent
- [ ] Live-world furnace integration test

## M3 — Reliable Teammate
- [ ] Goal verification
- [ ] Replanning
- [ ] death/item recovery
- [ ] hazard policies
- [ ] task cancellation
- [ ] player interruption

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
