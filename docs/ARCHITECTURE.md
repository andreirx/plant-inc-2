# Architecture Specification: The Hydraulics Engine

## 1. The Core (Simulation)
The world is a continuous vertical coordinate space.

### Data Model: The Graph
The plant is a Directed Acyclic Graph (DAG) of `PlantNode` objects.
- **Node Types:** `SEED`, `ROOT`, `TRUNK`, `BRANCH`, `LEAF`.
- **Connectivity:** Nodes have `parentId` and `childrenIds[]`.
- **State:**
    - `waterPressure` (0.0 - 1.0): Turgor pressure.
    - `sugarStore` (Float): Local energy buffer.
    - `radius` (Float): Determines flow capacity (Pipe width).

### The Loop (Fixed Timestep: 20Hz)
1. **Climate System:** Updates Sun intensity (Sine wave) and Soil Water availability (Depth gradient).
2. **Metabolism System:**
   - Leaves: Convert `Sun + Water` -> `Sugar`.
   - All Nodes: Consume `Sugar` (Respiration).
3. **Hydraulics System (The Physics):**
   - **Transpiration:** Leaves remove water, creating "Suction" (Negative Pressure).
   - **Uptake:** Roots add water (if `SoilWater > NodeWater`), creating Positive Pressure.
   - **Flow:** Resources move between connected nodes based on Pressure Gradients.
   - **Diffusion:** Sugars move from High Concentration to Low Concentration.

## 2. The Renderer (Tile-Based Engine)
Visuals use 64x64 pixel sprites. The engine supports "Texture Packs" (User-provided images) with a programmatic fallback.

### Asset Strategy
- **Standard:** 64x64px Grid.
- **Loading:** Checks `public/assets/tiles/`. If 404, generates procedural textures (Noise-filled rectangles) on the fly. But they need to be BELIEVABLE not just random garbage.
- **Layers:**
  1. **Sky:** Gradient + Sun Sprite moving in an arc.
  2. **Weather:** Particle containers for Rain/Snow/Fog overlays.
  3. **Soil Background:** Tiled sprites (Dirt/Clay/Rock). Varies with depth.
  4. **The Tree (Entity Layer):** 
     - Nodes are rendered as Rotated Sprites.
     - **Auto-Tiling Logic:** The Sprite ID (Bark_Straight, Bark_Fork, Root_Tip) is determined by the Node's connectivity (number of children/angles).
  5. **Fluids (Internal View):** 
     - 64x64 overlay tiles representing "Capillaries".
     - Only visible in "X-Ray Mode".
     - Animated opacity based on `waterPressure`.

## 3. Climate System (High Fidelity)
- **Sun Position:** Calculated via Azimuth/Elevation. Moves across the skybox. Shadows cast accordingly.
- **Atmosphere:**
  - `Overcast` (0-1): Reduces Sun Intensity, triggers Rain.
  - `Temperature`: Affects evaporation and freezing (Snow vs Rain).
  - `Wind`: sways the Tree Sprites (Vertex shader or simple rotation oscillation).

## 4. Interaction
- **Input:** Mouse/Touch.
- **Raycasting:** Mouse clicks are mapped to World Coordinates to find the nearest `PlantNode` radius.
- **Builder Pattern:** 
  `Input` -> `Select Node` -> `UI: Show Options` -> `Action: AddNode(Type)` -> `State Mutation`.

## 5. Tech Stack Decisions
- **Math:** Custom Vector2 helpers. No physics engine (Box2D is overkill); we only need Graph traversal.
- **State Management:** Reactive global store (Observable pattern) to trigger UI updates.