# Milo Architecture

## Product thesis

Milo should feel like a persistent second player, not a slash-command wrapper around an LLM.

The system therefore separates **high-level intent** from **low-level Minecraft execution**.

## Core loop

1. Player speaks naturally.
2. Intent layer extracts the goal and constraints.
3. Planner expands the goal into an executable task graph.
4. World model checks current inventory, nearby blocks/entities, known places and stored project state.
5. Skill layer selects reusable capabilities.
6. Executor performs actions through Mineflayer.
7. Verifier checks whether the expected world state actually happened.
8. Recovery logic replans when reality differs.
9. Memory records relevant outcomes.

## V0 -> V1 progression

### V0 — Presence
- connect/spawn
- recognize owner
- chat shell
- navigation
- remember home
- persistent JSON memory

### V0.1 — Resource loop
Target example:

```text
Milo get me 25 iron
```

Required task graph:

```text
understand request
-> inspect inventory
-> determine tools/food needed
-> locate or explore for resource
-> mine
-> recover from hazards/path failures
-> return home
-> locate designated storage
-> create/choose storage if allowed
-> smelt if player requested ingots
-> deposit requested amount
-> report extras/failures
-> save event to memory
```

### V0.2 — Storage intelligence
- label known containers by role
- remember chest coordinates
- infer preferred destination from contents
- never silently dump valuable items in random containers

### V0.3 — Project memory
- named projects
- material bill
- status and next task
- "continue the village"

### V0.4 — Proactive teammate
- observe shortages and risks
- suggest useful actions
- autonomy level controls

### V1 — Companion intelligence
- LLM intent/planning
- durable episodic memory
- reusable skill library
- richer safety and recovery

### Later
- reference-image -> build plan
- build verification/repair
- multiple specialized companions

## Module boundaries

Planned structure:

```text
src/
  index.js
  memory.js
  agent/
    intent.js
    planner.js
    verifier.js
  world/
    inventory.js
    places.js
    storage.js
    perception.js
  skills/
    movement.js
    gathering.js
    crafting.js
    smelting.js
    storage.js
    building.js
  safety/
    policy.js
    recovery.js
```

## Safety rules

Milo should require confirmation before:

- destroying player-built structures
- using diamonds/netherite or other explicitly protected materials
- entering high-risk dimensions/tasks when configured to ask
- replacing or emptying unknown storage
- executing arbitrary generated code

The planner can be creative. The executor should remain constrained.

## Memory model

V0 uses JSON for transparency and easy debugging.

Longer term, split memory into:

- **semantic**: "home is here", "ores go in this chest"
- **episodic**: "yesterday I died in this ravine"
- **project**: plans, material requirements, build state
- **spatial**: landmarks, routes, dangerous regions
- **preferences**: autonomy, protected blocks/items, play style

Memory should be inspectable and editable by the player.

## Design rule

**One reliable closed loop beats ten flashy demos.**

Until Milo can reliably complete "get resource -> come home -> store it", image building and multi-agent systems remain secondary.
