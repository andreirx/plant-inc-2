/**
 * Game balance constants and configuration.
 *
 * All tunable values should be defined here for easy iteration.
 */

export const CONFIG = {
  // === Simulation ===
  /** Target ticks per second */
  TICKS_PER_SECOND: 20,
  /** Seconds per in-game day */
  SECONDS_PER_DAY: 60,

  // === Initial Resources ===
  INITIAL_SUGAR: 100,
  INITIAL_WATER: 30,
  INITIAL_MINERALS: 20,

  // === Node Costs (Sugar) ===
  COST_LEAF: 10,
  COST_BRANCH: 15,
  COST_ROOT: 12,
  COST_TRUNK: 20,
  COST_HARDEN: 5, // Increase structural health

  // === Node Sizes (meters) ===
  SEED_RADIUS: 0.03,
  LEAF_RADIUS: 0.015,
  BRANCH_RADIUS: 0.02,
  ROOT_RADIUS: 0.018,
  TRUNK_RADIUS: 0.04,

  // === Hydraulics (Xylem - Water) ===
  /** Rate at which leaves lose water via transpiration */
  TRANSPIRATION_RATE: 0.03,
  /** Rate at which roots absorb water from soil */
  ROOT_UPTAKE_RATE: 0.12,
  /** Water flow rate between connected nodes (per pressure unit difference) */
  WATER_FLOW_RATE: 0.4,
  /** Minimum pressure differential to trigger flow */
  FLOW_THRESHOLD: 0.003,

  // === Hydraulics (Phloem - Sugar) ===
  /** Rate at which sugar diffuses from high to low concentration */
  SUGAR_DIFFUSION_RATE: 0.2,
  /** Minimum sugar to keep a node alive per tick */
  NODE_RESPIRATION_COST: 0.002,

  // === Metabolism (Photosynthesis) ===
  /** Sugar produced per leaf per tick at full sunlight */
  PHOTOSYNTHESIS_RATE: 0.5,
  /** Water consumed per unit of sugar produced */
  WATER_PER_SUGAR: 0.3,
  /** Minimum water pressure for photosynthesis */
  MIN_WATER_FOR_PHOTOSYNTHESIS: 0.15,

  // === Growth Limits ===
  /** Maximum number of children per node */
  MAX_CHILDREN_PER_NODE: 4,
  /** Maximum depth of the tree (from seed) */
  MAX_TREE_DEPTH: 20,

  // === Stress & Health ===
  /** Stress rate when sugar is depleted */
  STARVATION_STRESS_RATE: 0.005,
  /** Stress rate when water pressure is too low */
  DEHYDRATION_STRESS_RATE: 0.005,
  /** Recovery rate when conditions are good */
  HEALTH_RECOVERY_RATE: 0.02,
  /** Stress threshold at which node becomes inactive */
  STRESS_DEATH_THRESHOLD: 1.0,

  // === Climate ===
  /** Base temperature in Celsius */
  BASE_TEMPERATURE: 20,
  /** Temperature swing amplitude */
  TEMPERATURE_AMPLITUDE: 10,
  /** Minimum sun intensity at night */
  MIN_SUN_INTENSITY: 0.0,
  /** Maximum sun intensity at noon */
  MAX_SUN_INTENSITY: 1.0,
  /** Probability of rain starting per tick */
  RAIN_START_CHANCE: 0.01, // 1% chance per tick
  /** Probability of rain stopping per tick */
  RAIN_STOP_CHANCE: 0.01,
  /** Water added to soil per tick during rain */
  RAIN_WATER_RATE: 0.05,
  /** Water evaporated from soil per tick */
  EVAPORATION_RATE: 0.001, // Much slower evaporation

  // === Rendering ===
  /** Tile size in pixels */
  TILE_SIZE: 64,
  /** Pixels per meter for world-to-screen conversion */
  PIXELS_PER_METER: 256,
  /** Particle speed multiplier */
  PARTICLE_SPEED: 1.2,
  /** Maximum particles per flow connection */
  MAX_PARTICLES_PER_FLOW: 12,

  // === Colors ===
  COLOR_XYLEM: 0x4fc3f7, // Light blue for water
  COLOR_PHLOEM: 0xffd54f, // Gold for sugar
  COLOR_HEALTHY: 0x4caf50, // Green
  COLOR_STRESSED: 0x8b4513, // Brown
  COLOR_BARK: 0x5d3a1a,
  COLOR_LEAF: 0x2d8a4e,
  COLOR_ROOT: 0x8b6914,
  COLOR_SOIL_SURFACE: 0x4a3728,
  COLOR_SOIL_DEEP: 0x3d2b1f,
  COLOR_SKY_DAY: 0x87ceeb,
  COLOR_SKY_NIGHT: 0x1a1a2e,
  COLOR_SUN: 0xffd700,
} as const;

export type ConfigKey = keyof typeof CONFIG;
