/**
 * Metabolism System - Photosynthesis and Respiration.
 *
 * PHOTOSYNTHESIS (Leaves):
 * - Sunlight + Water + CO2 -> Sugar + O2
 * - Rate depends on sunlight intensity and water availability
 * - Only active leaves produce sugar
 *
 * RESPIRATION (All Nodes):
 * - Sugar -> Energy (consumed for maintenance)
 * - Every living node costs sugar to maintain
 * - Starving nodes accumulate stress and eventually die
 */

import type { GameState } from '../types';
import { getState, updateNode, modifyResources } from '../state';
import { CONFIG } from '../config';
import { spawnFlowParticle } from './hydraulics';

/**
 * Main metabolism update - call once per tick.
 */
export function updateMetabolism(): void {
  const state = getState();

  // Step 1: Photosynthesis - Leaves produce sugar
  processPhotosynthesis(state);

  // Step 2: Respiration - All nodes consume sugar
  processRespiration(state);

  // Step 3: Stress & Health - Update node conditions
  processStressAndHealth(state);
}

/**
 * Photosynthesis: Leaves convert sunlight + water into sugar.
 */
function processPhotosynthesis(state: GameState): void {
  const { climate } = state;

  for (const node of Object.values(state.nodes)) {
    if (!node.isActive) continue;

    // Only leaves and green tips photosynthesize
    if (node.type !== 'LEAF' && node.childrenIds.length > 0) continue;

    // Need minimum water for stomata to open
    if (node.waterPressure < CONFIG.MIN_WATER_FOR_PHOTOSYNTHESIS) continue;

    // Calculate photosynthesis rate
    // Minimum 15% rate at night (stored starch conversion)
    const sunFactor = 0.15 + climate.sunIntensity * 0.85;
    const waterFactor = Math.min(1, node.waterPressure / 0.5); // Optimal at 50%+ pressure
    const sizeFactor = node.radius * 10; // Larger leaves produce more

    const sugarProduced = CONFIG.PHOTOSYNTHESIS_RATE * sunFactor * waterFactor * sizeFactor;

    if (sugarProduced > 0) {
      // Consume water for photosynthesis
      const waterCost = sugarProduced * CONFIG.WATER_PER_SUGAR;

      updateNode(node.id, {
        waterPressure: Math.max(0, node.waterPressure - waterCost * 0.1),
        sugarStore: node.sugarStore + sugarProduced,
        sugarConcentration: Math.min(1.0, node.sugarConcentration + sugarProduced * 0.1),
      });

      // Add to global sugar pool
      modifyResources({ sugar: sugarProduced });

      // Spawn phloem particle - sugar being produced and ready to flow DOWN
      // Higher spawn rate to show continuous photosynthesis activity
      if (node.parentId && Math.random() < 0.1 + sunFactor * 0.25) {
        spawnFlowParticle(node.id, node.parentId, 'phloem', 0.6 + sugarProduced * 3);
      }
    }
  }
}

/**
 * Respiration: All living cells consume sugar for maintenance.
 */
function processRespiration(state: GameState): void {
  for (const node of Object.values(state.nodes)) {
    if (!node.isActive) continue;

    // Respiration cost based on node size
    const respirationCost = CONFIG.NODE_RESPIRATION_COST * (1 + node.radius * 5);

    // Try to consume from local sugar store first
    if (node.sugarStore >= respirationCost) {
      updateNode(node.id, {
        sugarStore: node.sugarStore - respirationCost,
        sugarConcentration: Math.max(0, node.sugarConcentration - respirationCost * 0.05),
      });

      // For roots consuming sugar, spawn phloem particle coming TO the root
      // This represents sugar being pulled down to feed the roots
      // Higher spawn rate to show continuous root activity
      if (node.type === 'ROOT' && node.parentId && Math.random() < 0.25) {
        spawnFlowParticle(node.parentId, node.id, 'phloem', 0.7);
      }
    } else {
      // Not enough local sugar - node is starving
      const deficit = respirationCost - node.sugarStore;

      updateNode(node.id, {
        sugarStore: 0,
        sugarConcentration: Math.max(0, node.sugarConcentration - 0.01),
        // Mark that this node is in deficit (will cause stress)
      });

      // Stress from starvation
      const stressIncrease = deficit * CONFIG.STARVATION_STRESS_RATE;
      updateNode(node.id, {
        stressLevel: Math.min(1, node.stressLevel + stressIncrease),
      });
    }
  }
}

/**
 * Stress and Health: Update node conditions based on resource availability.
 */
function processStressAndHealth(state: GameState): void {
  for (const node of Object.values(state.nodes)) {
    if (!node.isActive) continue;

    let stressDelta = 0;

    // Dehydration stress - only at very low water levels
    if (node.waterPressure < 0.08) {
      stressDelta += CONFIG.DEHYDRATION_STRESS_RATE * (0.08 - node.waterPressure);
    }

    // Recovery when conditions are reasonable (lower thresholds)
    if (node.waterPressure > 0.15 && node.sugarStore > 0.02) {
      stressDelta -= CONFIG.HEALTH_RECOVERY_RATE;
    } else if (node.waterPressure > 0.1) {
      // Partial recovery just from having some water
      stressDelta -= CONFIG.HEALTH_RECOVERY_RATE * 0.5;
    }

    // Apply stress change
    const newStress = Math.max(0, Math.min(1, node.stressLevel + stressDelta));

    // Update structural health (inverse of stress, with some momentum)
    const targetHealth = 1 - newStress * 0.8;
    const newHealth = node.structuralHealth + (targetHealth - node.structuralHealth) * 0.1;

    // Check for death
    if (newStress >= CONFIG.STRESS_DEATH_THRESHOLD) {
      updateNode(node.id, {
        stressLevel: 1,
        structuralHealth: 0,
        isActive: false,
      });
    } else {
      updateNode(node.id, {
        stressLevel: newStress,
        structuralHealth: Math.max(0, Math.min(1, newHealth)),
      });
    }
  }
}

/**
 * Get metabolism statistics for debugging/HUD.
 */
export function getMetabolismStats(): {
  totalPhotosynthesis: number;
  totalRespiration: number;
  healthyNodes: number;
  stressedNodes: number;
  deadNodes: number;
} {
  const state = getState();
  let healthyNodes = 0;
  let stressedNodes = 0;
  let deadNodes = 0;

  for (const node of Object.values(state.nodes)) {
    if (!node.isActive) {
      deadNodes++;
    } else if (node.stressLevel > 0.5) {
      stressedNodes++;
    } else {
      healthyNodes++;
    }
  }

  // These would be tracked per-tick for accurate values
  return {
    totalPhotosynthesis: 0, // Would need accumulator
    totalRespiration: 0,
    healthyNodes,
    stressedNodes,
    deadNodes,
  };
}
