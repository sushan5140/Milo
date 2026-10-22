# Milo + Minecraft Bedrock (Android) crossplay

## Supported route

Milo is a Mineflayer **Java-protocol** bot. Your Android Bedrock client can meet Milo **on a Java server** with Geyser and Floodgate installed. This is not a Bedrock-native bot or Android add-on, and Geyser does not translate Java bots into Bedrock server clients.

Topology:

- Android Minecraft Bedrock -> Geyser Bedrock listener -> Java server
- Milo on Windows (Node.js + Mineflayer) -> Java server
- Floodgate -> permits Bedrock account authentication without requiring the Android player to own Java Edition

Official references:
- https://geysermc.org/wiki/geyser/setup/
- https://geysermc.org/wiki/floodgate/setup/
- https://github.com/GeyserMC/Geyser
- https://github.com/GeyserMC/Floodgate

## Installation checklist (no Minecraft PC client required)

1. Install Node.js 20+ for Milo and a Java runtime appropriate to the selected server/Geyser versions (consult the official current requirements).
2. Install a compatible **Paper Java server** on Windows, or use an existing trusted Java host. Check version support against the current Geyser docs; do not blindly choose "latest" if it is incompatible with Milo's Mineflayer version.
3. Accept the Minecraft server EULA only after reading it. Run the server locally.
4. Install matching Geyser and Floodgate plugins into the Paper server's `plugins` folder as described in their official setup docs; restart it.
5. Configure Geyser's Bedrock listener and Floodgate integration using their current documentation. **Keep the Java server in authenticated online mode**; do not switch it to offline mode or turn off security to fix login errors.
6. Connect Milo to the Java listener using `MILO_HOST`, `MILO_PORT`, and an appropriately authenticated bot account. The Android purchase only licenses the Android client, **not a Java bot account**; check permitted bot authentication and hosting arrangement separately.
7. On Android (phone or Samsung Tab), go to Minecraft -> Play -> Servers -> Add Server and enter the server's **Bedrock listener address and port** displayed/configured by Geyser. For a LAN server use the laptop's LAN IP, not `localhost`. The Geyser transport/port requirements vary by current release.
8. Confirm the Bedrock player and Milo have both spawned in the **same world**. Use `Milo status` first, then `Milo come`; do not begin risky gathering tests before checking identity and permissions.

## Important constraints

- The Android world cannot just be joined directly by the current Mineflayer Milo; this setup requires a Java server as world host.
- Keep both game server and Milo process running while using the companion. Work after you disconnect also requires the host processes to remain online.
- Geyser is a Bedrock-to-Java bridge **only**, not a Java-to-Bedrock bridge.
- Be mindful of resource consumption on an 8 GB Windows machine; test an empty local world without heavyweight mods first.
- Never put passwords, Floodgate keys, or authentication files in this repository. Restrict listener access to trusted devices and follow the Geyser security docs.
- Milo currently pairs to the first recognized speaker if `MILO_OWNER` is unset. On a shared server set `MILO_OWNER` to the exact Bedrock name that the Java server reports, including any configured Floodgate prefix, before allowing anyone else to join. Test this on a private world first.
- Bedrock/Java behavioural differences may remain; verify actual inventory, interaction, mining, crafting, and chest transactions with live server tests.

## Acceptance gates (not yet passed)

- [ ] Bedrock client from Android connects through Geyser
- [ ] Milo authenticates and connects to the same Java world
- [ ] Owner pairing works for the translated Bedrock name
- [ ] Milo follows a Bedrock player reliably
- [ ] Milo mines, collects the drop and verifies its inventory
- [ ] Milo smelts and deposits items in chest
- [ ] Reconnect/restart does not falsely report finished tasks

This document only defines the integration pathway; it does **not** prove successful live crossplay.
