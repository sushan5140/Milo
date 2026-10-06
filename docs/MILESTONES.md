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
- [ ] reference-image interpretation
- [ ] block-palette proposal
- [ ] footprint preview
- [ ] materials plan
- [ ] build executor
- [ ] visual/world-state verification


## Next implementation batch
1. Add richer project goals and stages beyond materials: planning, site, build, verify.
2. Add project notes/decisions so Milo remembers design constraints and player preferences per project.
3. Add smarter collaborative suggestions based on project bottlenecks and current inventory/world context.
4. Start M5 reference-image -> build-plan data structures without executing destructive building yet.
5. Keep live-world M0-M3 smoke testing as a parallel integration track.
