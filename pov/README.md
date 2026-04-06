# POV Design Concepts

> Six alternative visual designs for "Bots in a Field" that incorporate a point-of-view perspective.

All concepts share the same game logic, strategy system, and bot AI from v11. Only the visual presentation changes. Each design document includes full rendering specs, code sketches, layout diagrams, and interaction details.

## Concepts at a Glance

| # | Name | One-liner | POV Type | Has Map? |
|---|------|-----------|----------|----------|
| 01 | [The Operative](01-the-operative.md) | Forward vision cone with fog of war | Heading-up FOV cone | Yes — minimap |
| 02 | [Sonar Pulse](02-sonar-pulse.md) | Full-screen radar with rotating sweep | Radar display (heading-up) | Radar IS the map |
| 03 | [The Cockpit](03-the-cockpit.md) | Chase camera with flight-sim HUD | Zoomed chase cam + HUD | Partial — rear mirror |
| 04 | [Echo Chamber](04-echo-chamber.md) | Dark world revealed by perception pulses | Perception-based | No map |
| 05 | [The Navigator](05-the-navigator.md) | Nautical chart with fog of war and ship's log | Chart = map = POV | Chart IS the map |
| 06 | [Command & Control](06-command-and-control.md) | Angled 3D overview + first-person POV inset | Dual: 3D tactical + FPS | Yes — the tactical view |

## Comparison Matrix

### Information & Awareness

| Concept | Info Density | Awareness Range | Info Decay? | Off-Screen Intel |
|---------|-------------|-----------------|-------------|------------------|
| Operative | Medium | 300u cone (limited) | No | Threat feed + minimap |
| Sonar | Low | 300u full circle | Yes — blips fade | Ghost trails |
| Cockpit | High | 500u (HUD reveals all) | No | Threat arrows 360° |
| Echo | Dynamic | 350u pulse | Yes — echoes fade | Sound ripples |
| Navigator | Medium | 120u fog-clear | Persistent (explored stays) | Log narrates events |
| C&C | High | Full field (tactical) | No | Both views combined |

### Visual Style

| Concept | Palette | Aesthetic | Animation Intensity |
|---------|---------|-----------|---------------------|
| Operative | Dark green/tactical | Military ops | Low — clean, minimal |
| Sonar | CRT green-on-black | Submarine warfare | Medium — sweep + fading |
| Cockpit | Standard + HUD chrome | Arcade flight sim | Medium — gauges, brackets |
| Echo | Near-black + blue pulses | Alien/ethereal | High — constant pulse/fade |
| Navigator | Parchment + ink | Cartographic | Low — static chart + log |
| C&C | Green field + dark UI | Command center | Medium — dual rendering |

### Emotional Impact

| Concept | Primary Emotion | Tension Source | Reward Feeling |
|---------|----------------|----------------|----------------|
| Operative | Tension | Blind spots, unseen threats | Safe detection, kills from shadow |
| Sonar | Suspense | Stale information, closing blips | Clean sweep, tracking prey |
| Cockpit | Empowerment | Multiple threats closing in | Locked-on kills, stats climbing |
| Echo | Wonder + dread | Darkness between pulses | Revelation, combat light show |
| Navigator | Adventure | Uncharted waters, log warnings | Territory claimed, rank promotion |
| C&C | Authority | Managing two viewpoints | Strategic kills, full awareness |

### Technical Complexity

| Concept | Rendering Cost | New Systems Needed | Dependencies |
|---------|---------------|-------------------|--------------|
| Operative | Low | Fog mask, cone geometry | None |
| Sonar | Low | Sweep rotation, blip tracking | None |
| Cockpit | Medium | Gauges, targeting, rear-view | None |
| Echo | Medium | Pulse system, fade trails, reflections | None |
| Navigator | Medium | Exploration grid, log system, chart deco | None |
| C&C | Medium-High | 3D projection (CSS or Three.js), POV rendering | Optional: Three.js |

## Design Axes

Each concept sits differently on three key axes:

```
    INFORMATION RICHNESS
    ▲
    │  Cockpit ●           ● C&C
    │
    │           ● Operative
    │
    │  Navigator ●
    │
    │        Sonar ●
    │
    │    Echo ●
    └──────────────────────────────► IMMERSION
    
    
    TENSION                    EMPOWERMENT
    ◄──────────────────────────────────►
    Echo    Sonar   Operative   Navigator   Cockpit   C&C
```

## Decision Criteria

When selecting which concepts to keep, consider:

1. **Gameplay feel:** Does the POV enhance or hinder the bot-watching experience? Some concepts (Echo, Sonar) actively restrict information, changing the experience fundamentally. Others (Cockpit, C&C) enhance it.

2. **Strategy relevance:** The game has a deep strategy system (Simple/Advanced/Expert modes). Does the POV let the player observe and appreciate their strategy choices? (C&C and Cockpit are best for this; Echo and Sonar obscure it.)

3. **Uniqueness:** Does this concept offer something you can't get from a top-down view? (Echo and Navigator are most unique; Cockpit is closest to "just a zoomed-in view with HUD.")

4. **Implementation effort:** All are pure canvas (no dependencies except optional Three.js for C&C). Complexity ranges from ~200 extra lines (Operative) to ~600 extra lines (C&C with Three.js).

5. **Combinability:** Some concepts can borrow elements from each other:
   - Cockpit's threat arrows work in any concept
   - Navigator's log works anywhere
   - Echo's pulse mechanic could layer onto Operative's cone
   - C&C's dual-view could use any other concept as the POV inset

## Hybrid Possibilities

The concepts aren't mutually exclusive. Some natural combinations:

| Hybrid | Description |
|--------|-------------|
| **C&C + Echo** | Tactical overview + Echo Chamber as the POV inset (pulse-based POV, god-view tactical) |
| **C&C + Cockpit** | Tactical overview + Cockpit HUD as the POV inset (targeting brackets in POV, strategic overview) |
| **Operative + Navigator** | Vision cone main view with ship's log narration instead of threat feed |
| **Sonar + Navigator** | Radar display with nautical log narration and rank system |
| **Echo + Cockpit** | Pulse-based dark world with flight-sim gauges and targeting |

## Next Steps

1. Review each design document in detail
2. Compare against the current v11 experience
3. Prune to 2–3 finalists
4. Optionally hybridize elements across concepts
5. Build a prototype of the selected design(s)
