/**
 * Auto-Grow System - AI-driven plant growth decisions.
 *
 * When enabled, automatically decides where to grow based on:
 * - Root/canopy balance (roots support the canopy)
 * - Resource levels (sugar for building, water for survival)
 * - Node health (thicken stressed segments)
 * - Strategic growth (extend to reach sunlight/water)
 */

import { getState, addNode, updateNode, extendNode } from '../state';
import { CONFIG } from '../config';
import type { PlantNode, NodeType, Vec2 } from '../types';
import { getChildren, getNodesByType } from '@utils/graph';

let autoGrowEnabled = false;
let ticksSinceLastGrowth = 0;
const BASE_GROWTH_INTERVAL = 15; // Base interval ~0.75 seconds at 20 tps

/**
 * Enable or disable auto-grow.
 */
export function setAutoGrow(enabled: boolean): void {
  autoGrowEnabled = enabled;
  ticksSinceLastGrowth = 0;
}

/**
 * Check if auto-grow is enabled.
 */
export function isAutoGrowEnabled(): boolean {
  return autoGrowEnabled;
}

/**
 * Main auto-grow update - call once per tick.
 */
export function updateAutoGrow(): void {
  if (!autoGrowEnabled) return;

  const state = getState();
  const { resources } = state;

  // Dynamic growth interval - grow faster when sugar is abundant
  const sugarExcess = Math.max(0, resources.sugar - 50);
  const speedBonus = Math.min(0.8, sugarExcess / 500); // Up to 80% faster
  const growthInterval = Math.max(5, BASE_GROWTH_INTERVAL * (1 - speedBonus));

  ticksSinceLastGrowth++;
  if (ticksSinceLastGrowth < growthInterval) return;

  ticksSinceLastGrowth = 0;

  // Need minimum sugar to consider growing
  if (resources.sugar < 20) return;

  // Analyze plant structure
  const analysis = analyzePlant(state);

  // Decide what to do based on analysis
  const action = decideAction(analysis, state);

  if (action) {
    executeAction(action, state);
  }
}

interface PlantAnalysis {
  leafCount: number;
  rootCount: number;
  trunkCount: number;
  branchCount: number;
  totalNodes: number;
  balanceRatio: number; // canopy/roots ratio (lower is more balanced)
  avgStress: number;
  weakestNode: PlantNode | null;
  growthTips: PlantNode[]; // Nodes that can grow
  extendableTrunks: PlantNode[]; // Trunks that can be extended
  extendableRoots: PlantNode[]; // Roots that can be extended
}

interface GrowAction {
  type: 'GROW' | 'THICKEN' | 'EXTEND';
  targetNode: PlantNode;
  growType?: NodeType;
  direction?: Vec2;
}

/**
 * Analyze the current plant structure.
 */
function analyzePlant(state: ReturnType<typeof getState>): PlantAnalysis {
  let leafCount = 0;
  let rootCount = 0;
  let trunkCount = 0;
  let branchCount = 0;
  let totalStress = 0;
  let weakestNode: PlantNode | null = null;
  let highestStress = 0;
  const growthTips: PlantNode[] = [];
  const extendableTrunks: PlantNode[] = [];
  const extendableRoots: PlantNode[] = [];

  for (const node of Object.values(state.nodes)) {
    if (!node.isActive) continue;

    // Count by type
    switch (node.type) {
      case 'LEAF':
        leafCount++;
        break;
      case 'ROOT':
        rootCount++;
        break;
      case 'TRUNK':
        trunkCount++;
        break;
      case 'BRANCH':
        branchCount++;
        break;
    }

    // Track stress
    totalStress += node.stressLevel;
    if (node.stressLevel > highestStress) {
      highestStress = node.stressLevel;
      weakestNode = node;
    }

    // Find growth tips (nodes with few children)
    const children = getChildren(state, node);
    if (children.length < CONFIG.MAX_CHILDREN_PER_NODE) {
      growthTips.push(node);
    }

    // Find extendable segments (have children, can be pushed further)
    if (node.childrenIds.length > 0) {
      if (node.type === 'TRUNK' || node.type === 'BRANCH') {
        extendableTrunks.push(node);
      } else if (node.type === 'ROOT') {
        extendableRoots.push(node);
      }
    }
  }

  const totalNodes = Object.keys(state.nodes).length;
  const canopySize = leafCount + trunkCount + branchCount;
  const balanceRatio = rootCount > 0 ? canopySize / rootCount : canopySize;

  return {
    leafCount,
    rootCount,
    trunkCount,
    branchCount,
    totalNodes,
    balanceRatio,
    avgStress: totalNodes > 0 ? totalStress / totalNodes : 0,
    weakestNode,
    growthTips,
    extendableTrunks,
    extendableRoots,
  };
}

/**
 * Decide what growth action to take based on analysis.
 */
function decideAction(
  analysis: PlantAnalysis,
  state: ReturnType<typeof getState>
): GrowAction | null {
  const { resources } = state;

  // Priority 1: If a node is critically stressed, thicken it
  if (analysis.weakestNode && analysis.weakestNode.stressLevel > 0.3) {
    if (
      resources.sugar >= CONFIG.COST_HARDEN &&
      (analysis.weakestNode.type === 'TRUNK' ||
        analysis.weakestNode.type === 'BRANCH' ||
        analysis.weakestNode.type === 'ROOT')
    ) {
      return {
        type: 'THICKEN',
        targetNode: analysis.weakestNode,
      };
    }
  }

  // Priority 2: Balance roots if canopy is too large
  if (analysis.balanceRatio > 3 && resources.sugar >= CONFIG.COST_ROOT) {
    // Find a root to extend or grow from
    const roots = getNodesByType(state, 'ROOT');
    const seed = state.nodes[state.seedId];

    if (roots.length > 0) {
      // Try to grow a new root from an existing root
      const targetRoot = roots[Math.floor(Math.random() * roots.length)];
      if (getChildren(state, targetRoot).length < CONFIG.MAX_CHILDREN_PER_NODE) {
        return {
          type: 'GROW',
          targetNode: targetRoot,
          growType: 'ROOT',
          direction: getRandomRootDirection(),
        };
      }
    } else if (seed && getChildren(state, seed).length < CONFIG.MAX_CHILDREN_PER_NODE) {
      // Grow first root from seed
      return {
        type: 'GROW',
        targetNode: seed,
        growType: 'ROOT',
        direction: { x: 0, y: 1 },
      };
    }
  }

  // Priority 3: Need more leaves for photosynthesis (but maintain balance)
  if (analysis.leafCount < analysis.rootCount * 2 && resources.sugar >= CONFIG.COST_LEAF) {
    // Find a trunk or branch to grow a leaf from
    const candidates = analysis.growthTips.filter(
      (n) => n.type === 'TRUNK' || n.type === 'BRANCH'
    );
    if (candidates.length > 0) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      return {
        type: 'GROW',
        targetNode: target,
        growType: 'LEAF',
        direction: { x: 0, y: -1 },
      };
    }
  }

  // Priority 4: Extend existing structure for better reach
  if (resources.sugar >= CONFIG.COST_TRUNK && Math.random() < 0.3) {
    // Occasionally extend trunk upward
    if (analysis.extendableTrunks.length > 0) {
      const target =
        analysis.extendableTrunks[Math.floor(Math.random() * analysis.extendableTrunks.length)];
      return {
        type: 'EXTEND',
        targetNode: target,
        direction: { x: 0, y: -1 },
      };
    }
  }

  // Priority 5: Grow new trunk/branch upward
  if (resources.sugar >= CONFIG.COST_TRUNK) {
    const trunks = analysis.growthTips.filter((n) => n.type === 'TRUNK' || n.type === 'SEED');
    if (trunks.length > 0) {
      const target = trunks[Math.floor(Math.random() * trunks.length)];
      return {
        type: 'GROW',
        targetNode: target,
        growType: 'TRUNK',
        direction: { x: 0, y: -1 },
      };
    }
  }

  // Priority 6: Grow branches sideways
  if (resources.sugar >= CONFIG.COST_BRANCH && Math.random() < 0.4) {
    const candidates = analysis.growthTips.filter((n) => n.type === 'TRUNK');
    if (candidates.length > 0) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      const dir = Math.random() < 0.5 ? { x: -1, y: -1 } : { x: 1, y: -1 };
      return {
        type: 'GROW',
        targetNode: target,
        growType: 'BRANCH',
        direction: dir,
      };
    }
  }

  return null;
}

/**
 * Execute a growth action.
 */
function executeAction(action: GrowAction, state: ReturnType<typeof getState>): void {
  switch (action.type) {
    case 'THICKEN': {
      const newRadius = action.targetNode.radius * 1.2;
      updateNode(action.targetNode.id, { radius: newRadius });
      state.resources.sugar -= CONFIG.COST_HARDEN;
      console.log(`[AutoGrow] Thickened ${action.targetNode.type}`);
      break;
    }

    case 'EXTEND': {
      if (action.direction) {
        const newNode = extendNode(action.targetNode.id, action.direction);
        if (newNode) {
          console.log(`[AutoGrow] Extended ${action.targetNode.type}`);
        }
      }
      break;
    }

    case 'GROW': {
      if (action.growType && action.direction) {
        const tileInMeters = CONFIG.TILE_SIZE / CONFIG.PIXELS_PER_METER;
        const newPos: Vec2 = {
          x: action.targetNode.position.x + action.direction.x * tileInMeters,
          y: action.targetNode.position.y + action.direction.y * tileInMeters,
        };

        // Check if position is already occupied
        const gridX = Math.round((newPos.x * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
        const gridY = Math.round((newPos.y * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);

        let occupied = false;
        for (const node of Object.values(state.nodes)) {
          const nx = Math.round((node.position.x * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
          const ny = Math.round((node.position.y * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
          if (nx === gridX && ny === gridY) {
            occupied = true;
            break;
          }
        }

        if (!occupied) {
          const newNode = addNode(action.targetNode.id, action.growType, newPos);
          if (newNode) {
            console.log(`[AutoGrow] Grew ${action.growType}`);
          }
        }
      }
      break;
    }
  }
}

/**
 * Get a random direction for root growth.
 */
function getRandomRootDirection(): Vec2 {
  const directions: Vec2[] = [
    { x: 0, y: 1 }, // Down
    { x: -1, y: 1 }, // Down-left
    { x: 1, y: 1 }, // Down-right
  ];
  return directions[Math.floor(Math.random() * directions.length)];
}
