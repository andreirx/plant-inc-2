# Product Vision: Sap & Sun

A "Bridge Constructor meets Botany" engineering simulation. The player manually constructs a tree node-by-node, managing the hydraulic pressures and metabolic flows required to keep a massive organism alive.

## Target Audience
- **Age:** 12+ (Focus on Systems Thinking & Biology).
- **Vibe:** "Kerbal Space Program" for Plants. It should feel like operating a complex machine.

## Core Pillars
1. **Hydraulic Realism:** The core mechanic is the flow of fluids. Water/Minerals move UP (Xylem) due to transpiration pull. Sugar moves DOWN (Phloem) to feed roots. If the flow stops, the plant dies.
2. **Construction, Not Evolution:** The player does not "select a trait." The player *builds* a branch, *places* a leaf, or *extends* a taproot. The shape and function are entirely player-controlled.
3. **Visualizing the Invisible:** We explicitly render the "Seva" (Sap).
   - **Blue Particles:** Water/Minerals moving up.
   - **Gold Particles:** Sugars moving down.
   - **Brown/Withered Nodes:** Visual feedback for lack of pressure/nutrients.

## Gameplay Loop
1. **Analyze:** Check Xylem pressure (Blue) and Phloem reserves (Gold).
2. **Build:** Spend Sugar to grow a new Node (Root tip or Branch tip).
3. **Simulate:** Watch the particles flow. Does the new leaf get enough water? Does the new root get enough sugar?
4. **Prune:** Cut off inefficient branches that consume more than they produce.