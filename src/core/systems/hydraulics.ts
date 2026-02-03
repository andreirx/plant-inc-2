/**
 * Hydraulics System - The "Seva" Physics Engine.
 *
 * This is the HEART of the simulation. It calculates fluid flow through the plant.
 *
 * XYLEM (Water - Blue Particles):
 * - Water moves UP from roots to leaves
 * - Driven by TRANSPIRATION PULL: leaves lose water, creating negative pressure
 * - Flow rate depends on pressure differential and pipe thickness (radius)
 *
 * PHLOEM (Sugar - Gold Particles):
 * - Sugar moves DOWN from leaves to roots
 * - Driven by DIFFUSION: high concentration to low concentration
 * - Feeds root tips for growth
 *
 * Visual particles are spawned when resources move between nodes.
 */

import type { FlowParticle, GameState } from '../types';
import { getState, updateNode, modifyResources } from '../state';
import { CONFIG } from '../config';
import { getChildren, getNodesByType } from '@utils/graph';

export type { FlowParticle } from '../types';
import { getSoilWaterAtDepth } from './climate';

// Particle tracking for visualization
let particles: FlowParticle[] = [];
let nextParticleId = 1;

// Global particle budget - prevents performance issues on large trees
const MAX_TOTAL_PARTICLES = 150;
const MAX_PARTICLES_PER_CONNECTION = 2;

// Track particles per connection for fair distribution
const connectionParticleCounts = new Map<string, number>();

export function getParticles(): FlowParticle[] {
  return particles;
}

export function clearParticles(): void {
  particles = [];
  connectionParticleCounts.clear();
}

/**
 * Main hydraulics update - call once per tick.
 * Processes water flow (Xylem) and sugar flow (Phloem).
 */
export function updateHydraulics(): void {
  const state = getState();

  // Step 1: Transpiration - Leaves lose water
  processTranspiration(state);

  // Step 2: Root Uptake - Roots gain water from soil
  processRootUptake(state);

  // Step 3: Water Flow (Xylem) - Move water up the tree
  processXylemFlow(state);

  // Step 4: Sugar Flow (Phloem) - Move sugar down the tree
  processPhloemFlow(state);

  // Step 5: Update particles
  updateParticles(state);
}

/**
 * Transpiration: Leaves lose water to the atmosphere.
 * This creates the "suction" that pulls water up from roots.
 */
function processTranspiration(state: GameState): void {
  const { climate } = state;

  // Transpiration rate depends on sunlight and temperature
  // Minimum 20% rate at night to maintain some baseline flow
  const baseFactor = 0.2;
  const sunFactor = climate.sunIntensity * (1 + climate.temperature / 40);
  const transpFactor = baseFactor + sunFactor * 0.8;

  for (const node of Object.values(state.nodes)) {
    if (!node.isActive) continue;

    // Only leaves and tips transpire significantly
    if (node.type === 'LEAF' || node.childrenIds.length === 0) {
      const waterLoss = CONFIG.TRANSPIRATION_RATE * transpFactor * node.radius;

      // Only transpire if we have water above minimum
      if (node.waterPressure > 0.15) {
        // Reduce water pressure but maintain minimum level
        const actualLoss = Math.min(waterLoss, node.waterPressure - 0.12);
        const newPressure = Math.max(0.12, node.waterPressure - actualLoss);

        if (actualLoss > 0) {
          updateNode(node.id, { waterPressure: newPressure });

          // Transpiration creates demand - spawn xylem particle going TO this leaf
          if (node.parentId && Math.random() < 0.05) {
            spawnParticle(node.parentId, node.id, 'xylem', 0.8 + transpFactor * 0.5);
          }
        }
      }
    }
  }
}

/**
 * Root Uptake: Roots absorb water from soil.
 * This creates positive pressure at the bottom of the system.
 */
function processRootUptake(state: GameState): void {
  const rootNodes = getNodesByType(state, 'ROOT');

  for (const root of rootNodes) {
    if (!root.isActive) continue;

    // Get soil water at root depth (y position is positive for below ground)
    const depth = Math.abs(root.position.y);
    const soilWater = getSoilWaterAtDepth(depth);

    // Uptake if soil has water and root isn't saturated
    if (soilWater > 0.1 && root.waterPressure < 0.95) {
      const uptake =
        CONFIG.ROOT_UPTAKE_RATE * root.radius * Math.max(0.1, soilWater - root.waterPressure);

      const newPressure = Math.min(1.0, root.waterPressure + uptake);

      if (uptake > 0.001) {
        updateNode(root.id, { waterPressure: newPressure });
        modifyResources({ water: uptake * 10 }); // Add to global pool

        // Root uptake - spawn xylem particle going UP from root
        if (root.parentId && Math.random() < 0.05) {
          spawnParticle(root.id, root.parentId, 'xylem', 0.8 + soilWater * 0.5);
        }
      }
    }
  }
}

/**
 * Xylem Flow: Water moves from high pressure (roots) to low pressure (leaves).
 * Traverses the tree bottom-up.
 */
function processXylemFlow(state: GameState): void {
  // Process from roots upward
  // For each node, if parent has higher pressure, transfer water up

  for (const node of Object.values(state.nodes)) {
    if (!node.isActive || !node.parentId) continue;

    const parent = state.nodes[node.parentId];
    if (!parent || !parent.isActive) continue;

    // Water flows FROM parent TO child if parent has higher pressure
    // (In xylem, pressure decreases as you go up)
    const pressureDiff = parent.waterPressure - node.waterPressure;

    if (pressureDiff > CONFIG.FLOW_THRESHOLD) {
      // Flow rate depends on pressure differential and pipe thickness
      const flowCapacity = Math.min(node.radius, parent.radius);
      const flowRate = CONFIG.WATER_FLOW_RATE * pressureDiff * flowCapacity;

      // Transfer water
      const actualFlow = Math.min(flowRate, parent.waterPressure * 0.5);

      updateNode(parent.id, {
        waterPressure: parent.waterPressure - actualFlow,
      });
      updateNode(node.id, {
        waterPressure: Math.min(1.0, node.waterPressure + actualFlow * 0.95), // 5% loss
      });

      // Spawn particle for visualization
      if (actualFlow > 0.0005 && Math.random() < 0.3) {
        spawnParticle(parent.id, node.id, 'xylem', actualFlow * 15);
      }
    }

    // Ambient xylem flow - always show water movement throughout the plant
    // Low spawn rate to stay within budget on large trees
    if (parent.waterPressure > 0.1 || node.waterPressure > 0.1) {
      if (Math.random() < 0.02) {
        spawnParticle(parent.id, node.id, 'xylem', 0.8);
      }
    }
  }
}

/**
 * Phloem Flow: Sugar moves from high concentration (leaves) to low concentration (roots).
 * This feeds the growth tips and maintains the system.
 */
function processPhloemFlow(state: GameState): void {
  // Sugar diffuses from high to low concentration
  // Leaves produce sugar (handled in metabolism), roots consume it

  for (const node of Object.values(state.nodes)) {
    if (!node.isActive) continue;

    const children = getChildren(state, node);

    for (const child of children) {
      if (!child.isActive) continue;

      // Sugar flows from high concentration to low concentration
      const concDiff = node.sugarConcentration - child.sugarConcentration;

      if (Math.abs(concDiff) > CONFIG.FLOW_THRESHOLD) {
        const flowCapacity = Math.min(node.radius, child.radius);
        const flowRate = CONFIG.SUGAR_DIFFUSION_RATE * Math.abs(concDiff) * flowCapacity;
        const actualFlow = flowRate;

        if (concDiff > 0) {
          // Flow from parent to child (down)
          updateNode(node.id, {
            sugarConcentration: node.sugarConcentration - actualFlow * 0.5,
            sugarStore: Math.max(0, node.sugarStore - actualFlow),
          });
          updateNode(child.id, {
            sugarConcentration: Math.min(1.0, child.sugarConcentration + actualFlow * 0.45),
            sugarStore: child.sugarStore + actualFlow * 0.9,
          });

          if (actualFlow > 0.0005 && Math.random() < 0.3) {
            spawnParticle(node.id, child.id, 'phloem', actualFlow * 15);
          }
        } else {
          // Flow from child to parent (up) - less common but possible
          updateNode(child.id, {
            sugarConcentration: child.sugarConcentration - Math.abs(actualFlow) * 0.5,
          });
          updateNode(node.id, {
            sugarConcentration: Math.min(1.0, node.sugarConcentration + Math.abs(actualFlow) * 0.45),
          });

          if (Math.abs(actualFlow) > 0.0005 && Math.random() < 0.3) {
            spawnParticle(child.id, node.id, 'phloem', Math.abs(actualFlow) * 15);
          }
        }
      }

      // Ambient phloem flow - sugar flows DOWN from leaves to roots
      // Low spawn rate to stay within budget on large trees
      if (node.isActive && child.isActive) {
        if (Math.random() < 0.02) {
          // Flow from child toward parent (down the plant, toward roots)
          spawnParticle(child.id, node.id, 'phloem', 0.7);
        }
      }
    }
  }
}

/**
 * Spawn a new flow particle for visualization.
 * Exported so other systems (metabolism) can spawn particles too.
 *
 * Uses a global budget system to prevent performance issues on large trees.
 */
export function spawnFlowParticle(
  fromNodeId: string,
  toNodeId: string,
  type: 'xylem' | 'phloem',
  speed: number
): void {
  // Global budget check - don't spawn if at capacity
  if (particles.length >= MAX_TOTAL_PARTICLES) return;

  // Per-connection limit check (using cached count for O(1) lookup)
  const connectionKey = `${fromNodeId}->${toNodeId}`;
  const connectionCount = connectionParticleCounts.get(connectionKey) || 0;
  if (connectionCount >= MAX_PARTICLES_PER_CONNECTION) return;

  // Spawn the particle
  connectionParticleCounts.set(connectionKey, connectionCount + 1);

  particles.push({
    id: `particle_${nextParticleId++}`,
    fromNodeId,
    toNodeId,
    progress: 0,
    type,
    speed: Math.min(3, Math.max(0.5, speed) * CONFIG.PARTICLE_SPEED),
  });
}

// Internal alias for backward compatibility
const spawnParticle = spawnFlowParticle;

/**
 * Update particle positions and remove completed ones.
 */
function updateParticles(state: GameState): void {
  const tickDelta = 1 / CONFIG.TICKS_PER_SECOND;

  particles = particles.filter((particle) => {
    // Check if nodes still exist
    const fromNode = state.nodes[particle.fromNodeId];
    const toNode = state.nodes[particle.toNodeId];

    if (!fromNode || !toNode) {
      // Decrement connection count
      decrementConnectionCount(particle.fromNodeId, particle.toNodeId);
      return false;
    }

    // Update progress
    particle.progress += particle.speed * tickDelta;

    // Remove if complete
    if (particle.progress >= 1.0) {
      decrementConnectionCount(particle.fromNodeId, particle.toNodeId);
      return false;
    }

    return true;
  });
}

/**
 * Decrement the particle count for a connection.
 */
function decrementConnectionCount(fromNodeId: string, toNodeId: string): void {
  const connectionKey = `${fromNodeId}->${toNodeId}`;
  const count = connectionParticleCounts.get(connectionKey) || 0;
  if (count <= 1) {
    connectionParticleCounts.delete(connectionKey);
  } else {
    connectionParticleCounts.set(connectionKey, count - 1);
  }
}

/**
 * Get flow statistics for debugging/HUD.
 */
export function getFlowStats(): {
  xylemParticles: number;
  phloemParticles: number;
  totalWaterPressure: number;
  totalSugar: number;
} {
  const state = getState();

  let totalWaterPressure = 0;
  let totalSugar = 0;

  for (const node of Object.values(state.nodes)) {
    totalWaterPressure += node.waterPressure;
    totalSugar += node.sugarStore;
  }

  return {
    xylemParticles: particles.filter((p) => p.type === 'xylem').length,
    phloemParticles: particles.filter((p) => p.type === 'phloem').length,
    totalWaterPressure,
    totalSugar,
  };
}
