/**
 * Core type definitions for the Sap & Sun hydraulic plant simulation.
 *
 * The plant is a Directed Acyclic Graph (DAG) of PlantNode objects.
 * Resources flow through this graph based on pressure gradients:
 * - Xylem: Water + Minerals flow UP (driven by transpiration pull)
 * - Phloem: Sugars flow DOWN (driven by diffusion from leaves to roots)
 */

export type NodeType = 'SEED' | 'ROOT' | 'TRUNK' | 'BRANCH' | 'LEAF';

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlantNode {
  id: string;
  type: NodeType;

  /** Position in world coordinates. Origin (0,0) is at ground level, seed location. */
  position: Vec2;

  // Graph Topology
  parentId: string | null;
  childrenIds: string[];

  // Biological Stats
  /** Thickness of the node - determines flow capacity (pipe width) */
  radius: number;
  /** Structural integrity: 0 = dead/broken, 1 = fully healthy */
  structuralHealth: number;

  // Hydraulics (The "Seva")
  /** Turgor pressure from water (0-1). Drives Xylem flow. */
  waterPressure: number;
  /** Sugar concentration (0-1). Drives Phloem flow. */
  sugarConcentration: number;

  /** Local energy buffer - sugars stored in this node's cells */
  sugarStore: number;

  // Status
  /** Is this node actively participating in flow? Dead nodes are inactive. */
  isActive: boolean;

  /** Visual stress indicator: 0 = healthy green, 1 = withered brown */
  stressLevel: number;
}

export interface ClimateState {
  /** Sun intensity at current position (0-1). Follows day/night cycle. */
  sunIntensity: number;
  /** Sun angle in radians. 0 = dawn (east), PI/2 = noon, PI = dusk (west) */
  sunAngle: number;
  /** Temperature in Celsius */
  temperature: number;
  /** Atmospheric humidity (0-1) */
  humidity: number;
  /** Soil water availability at surface level (0-1) */
  soilWater: number;
  /** Is it currently raining? */
  isRaining: boolean;
  /** Current time of day (0-1, where 0.5 = noon) */
  dayProgress: number;
  /** Current day number (starts at 1) */
  day: number;
  /** Total elapsed game ticks */
  tick: number;
}

export interface GameResources {
  /** Total sugar available for construction (the "currency") */
  sugar: number;
  /** Total water in the plant system */
  water: number;
  /** Mineral nutrients (N, P, K combined for simplicity) */
  minerals: number;
}

export interface GameState {
  /** All plant nodes indexed by ID */
  nodes: Record<string, PlantNode>;
  /** ID of the seed node (root of the DAG) */
  seedId: string;
  /** Global resource pool */
  resources: GameResources;
  /** Current climate conditions */
  climate: ClimateState;
  /** Selected node ID for UI interactions */
  selectedNodeId: string | null;
  /** Is the game paused? */
  isPaused: boolean;
  /** Simulation speed multiplier */
  speedMultiplier: number;
}

/** Event types for state change notifications */
export type GameEventType =
  | 'node:added'
  | 'node:removed'
  | 'node:updated'
  | 'resources:changed'
  | 'climate:updated'
  | 'selection:changed'
  | 'tick';

export interface GameEvent {
  type: GameEventType;
  payload?: unknown;
}

/** Listener callback type */
export type GameEventListener = (event: GameEvent) => void;

/** Direction of flow for particles */
export type FlowDirection = 'up' | 'down';

/** Particle for visualizing sap flow */
export interface FlowParticle {
  id: string;
  /** Source node ID */
  fromNodeId: string;
  /** Target node ID */
  toNodeId: string;
  /** Progress along path (0-1) */
  progress: number;
  /** Type of sap: 'xylem' (water, blue) or 'phloem' (sugar, gold) */
  type: 'xylem' | 'phloem';
  /** Speed multiplier based on pressure differential */
  speed: number;
}
