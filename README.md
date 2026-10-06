# Milo

> A persistent AI Minecraft companion that lives in your world, remembers it, helps proactively, and works toward shared goals.

Milo is not meant to be a command bot. The goal is to make an AI feel like a second player: someone you can talk to naturally, send on errands, build with, and gradually teach the layout and history of your Minecraft world.

## V0 target

The first milestone is deliberately narrow:

**Talk -> understand intent -> plan -> move/gather/craft -> return home -> store correctly -> report -> remember.**

Example:

```text
You: Milo, get me around 25 iron. I'm working on the house.

Milo: got it. I'll put it in the materials chest when I'm back.
```

Milo should be able to turn that into a multi-step task without the player micromanaging every action.

## Long-term vision

- Natural in-game conversation
- Persistent world memory
- Remembered bases, chests, mines, farms, portals and danger zones
- Project memory ("continue the medieval village")
- Autonomous resource gathering and crafting
- Correct storage and inventory organization
- Initiative/autonomy levels
- Physical communication ("follow me", standing at suggested build sites)
- Image-to-build planning
- Mistake/death recovery
- Multiple specialized AI companions later

## Architecture

```text
Player
  |
  v
Conversation / Intent
  |
  v
Planner + Task Manager
  |-------- Memory
  |-------- Skills
  |-------- World Model
  |-------- Vision (later)
  v
Action Executor
  |
  v
Mineflayer + Pathfinder
  |
  v
Minecraft Java Server
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the working design.

## Current status

**Stage: V0 scaffold**

The initial code can:

- connect as a Minecraft Java bot
- listen to player chat
- expose a tiny command/intention shell
- move to the player
- report position/status
- maintain a local JSON memory file

The autonomous gather/store loop is the next implementation target.

## Quick start

Requirements:

- Node.js 20+
- Minecraft Java server/world reachable by the bot

```bash
npm install
cp .env.example .env
npm start
```

Then edit `.env` for your server.

Try in Minecraft:

```text
Milo come
Milo status
Milo remember home
Milo where is home
```

## Principles

1. **Intent over commands** — the player says what they want, not every intermediate step.
2. **Ask before destructive actions** — Milo must not casually alter existing builds.
3. **Memory is visible and inspectable** — no mysterious hidden world state.
4. **Recover instead of freezing** — blocked paths, missing tools and death should become replanning events.
5. **One excellent companion before many mediocre agents.**

## Stack

- Node.js
- Mineflayer
- mineflayer-pathfinder
- minecraft-data
- local JSON memory for V0

Mineflayer is currently published as 4.39.0 and minecraft-data as 3.117.0; dependency versions are pinned in `package.json`.

## License

TBD.
