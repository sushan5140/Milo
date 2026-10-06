# Milo Live-World Smoke Test

Use a disposable Minecraft Java world/server first. Do not test destructive autonomy in an important world.

## 0. Setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set host/port/auth/owner.
4. Run:
   ```bash
   npm install
   npm test
   npm start
   ```

## 1. Presence

In chat:

```text
Milo status
Milo remember home
Milo come
Milo go home
```

Expected:
- Milo joins without repeated disconnects.
- pathfinding reaches the player/home.
- restart Milo and verify home is still remembered.

## 2. Storage

Stand within 8 blocks of a test chest/barrel:

```text
Milo remember storage
Milo status
```

Restart Milo and confirm storage remains known.

## 3. Simple resource

Give Milo a valid pickaxe and test:

```text
Milo get me 4 coal
```

Expected:
- finds reachable coal in loaded/searchable area
- mines it
- returns home
- deposits 4 into remembered storage
- reports a verified 4/4 delivery

## 4. Partial-goal verifier

Use a world where fewer requested blocks are reachable:

```text
Milo get me 20 coal
```

Expected:
- Milo must NOT claim success if only a partial amount was delivered
- task becomes resumable
- `Milo resume` continues the same task

## 5. Tool crafting

Remove Milo's usable pickaxe but provide:
- nearby crafting table
- sticks/planks or logs
- sufficient valid head material

Request a resource requiring the tool.

Expected:
- Milo crafts a mining-tier-valid tool
- it must not use a wooden/gold pickaxe for diamond/redstone/gold/emerald

## 6. Smelting

Provide raw-ore access and fuel:

```text
Milo get me 3 iron
```

Expected:
- iron means finished ingots
- Milo uses an existing furnace, or crafts/places one if possible
- storage receives iron ingots, not raw iron

Then test:

```text
Milo get me 3 raw iron
```

Expected:
- no smelting step

## 7. Cancellation/resume

Start a longer request:

```text
Milo get me 32 coal
Milo stop
```

After Milo is idle:

```text
Milo resume
```

Expected:
- original task survives cancellation
- resume uses the original goal rather than starting a different task

## 8. Death recovery

Let Milo die in a controlled location with harmless test inventory.

Then:

```text
Milo recover items
```

Expected:
- Milo returns to remembered death coordinates
- recovery report is based on inventory delta
- Milo does not claim recovery if inventory did not increase

## 9. Hazard guard

Expose a target ore directly adjacent to lava.

Expected:
- Milo refuses/skips that target
- it does not dig the guarded block merely because it is the nearest ore

## Failure evidence to save

When anything fails, keep:
- terminal error text
- Minecraft version
- server software/version
- command issued
- Milo coordinates
- target coordinates if relevant
- whether home/storage/crafting table/furnace were nearby
- relevant `data/memory.json` task/event entries

That gives us enough evidence to patch the integration layer without guessing.
