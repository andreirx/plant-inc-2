/**
 * Reactive game state management.
 *
 * Provides a global state store with observable pattern for UI updates.
 * The state is initialized with a single SEED node at origin (0,0).
 */

import type {
  GameState,
  PlantNode,
  GameEvent,
  GameEventListener,
  NodeType,
  Vec2,
} from './types';
import { CONFIG } from './config';

// Unique ID generator
let nextId = 1;
export function generateId(): string {
  return `node_${nextId++}`;
}

// Event listeners
const listeners: Set<GameEventListener> = new Set();

export function subscribe(listener: GameEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: GameEvent): void {
  listeners.forEach((listener) => listener(event));
}

// Initial state factory
function createInitialState(): GameState {
  const seedId = generateId();

  const seedNode: PlantNode = {
    id: seedId,
    type: 'SEED',
    position: { x: 0, y: 0 },
    parentId: null,
    childrenIds: [],
    radius: CONFIG.SEED_RADIUS,
    structuralHealth: 1.0,
    waterPressure: 0.5,
    sugarConcentration: 0.8, // Seeds start with stored energy
    sugarStore: CONFIG.INITIAL_SUGAR,
    isActive: true,
    stressLevel: 0,
  };

  return {
    nodes: { [seedId]: seedNode },
    seedId,
    resources: {
      sugar: CONFIG.INITIAL_SUGAR,
      water: CONFIG.INITIAL_WATER,
      minerals: CONFIG.INITIAL_MINERALS,
    },
    climate: {
      sunIntensity: 0.5,
      sunAngle: Math.PI / 4, // Morning
      temperature: 20,
      humidity: 0.5,
      soilWater: 0.9, // Start with moist soil
      isRaining: true, // Start with rain to ensure water flow
      dayProgress: 0.25,
      day: 1,
      tick: 0,
    },
    selectedNodeId: null,
    isPaused: false,
    speedMultiplier: 1,
  };
}

// The global state
let state: GameState = createInitialState();

// State accessors
export function getState(): GameState {
  return state;
}

export function resetState(): void {
  nextId = 1;
  state = createInitialState();
  emit({ type: 'tick' });
}

// Node operations
export function addNode(
  parentId: string,
  type: NodeType,
  position: Vec2,
  radius?: number
): PlantNode | null {
  const parent = state.nodes[parentId];
  if (!parent) {
    console.warn(`addNode: Parent ${parentId} not found`);
    return null;
  }

  // Check sugar cost
  const cost = getNodeCost(type);
  if (state.resources.sugar < cost) {
    console.warn(`addNode: Not enough sugar (have ${state.resources.sugar}, need ${cost})`);
    return null;
  }

  console.log(`addNode: Creating ${type} at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}) from parent ${parent.type}`);

  const nodeId = generateId();
  const node: PlantNode = {
    id: nodeId,
    type,
    position,
    parentId,
    childrenIds: [],
    radius: radius ?? getDefaultRadius(type),
    structuralHealth: 1.0,
    waterPressure: Math.max(0.3, parent.waterPressure * 0.95), // Inherit from parent with small loss, min 30%
    sugarConcentration: Math.max(0.2, parent.sugarConcentration * 0.9),
    sugarStore: 0,
    isActive: true,
    stressLevel: 0,
  };

  // Update state
  state.nodes[nodeId] = node;
  parent.childrenIds.push(nodeId);
  state.resources.sugar -= cost;

  emit({ type: 'node:added', payload: { nodeId, node } });
  emit({ type: 'resources:changed', payload: state.resources });

  return node;
}

export function removeNode(nodeId: string): boolean {
  const node = state.nodes[nodeId];
  if (!node) return false;

  // Cannot remove the seed
  if (node.type === 'SEED') return false;

  // Remove from parent's children
  if (node.parentId) {
    const parent = state.nodes[node.parentId];
    if (parent) {
      parent.childrenIds = parent.childrenIds.filter((id) => id !== nodeId);
    }
  }

  // Recursively remove children
  const removeRecursive = (id: string): void => {
    const n = state.nodes[id];
    if (!n) return;
    for (const childId of n.childrenIds) {
      removeRecursive(childId);
    }
    delete state.nodes[id];
  };

  removeRecursive(nodeId);

  emit({ type: 'node:removed', payload: { nodeId } });
  return true;
}

export function updateNode(nodeId: string, updates: Partial<PlantNode>): void {
  const node = state.nodes[nodeId];
  if (!node) return;

  Object.assign(node, updates);
  emit({ type: 'node:updated', payload: { nodeId, updates } });
}

// Resource operations
export function modifyResources(delta: Partial<GameState['resources']>): void {
  if (delta.sugar !== undefined) {
    state.resources.sugar = Math.max(0, state.resources.sugar + delta.sugar);
  }
  if (delta.water !== undefined) {
    state.resources.water = Math.max(0, state.resources.water + delta.water);
  }
  if (delta.minerals !== undefined) {
    state.resources.minerals = Math.max(0, state.resources.minerals + delta.minerals);
  }
  emit({ type: 'resources:changed', payload: state.resources });
}

// Climate operations
export function updateClimate(updates: Partial<GameState['climate']>): void {
  Object.assign(state.climate, updates);
  emit({ type: 'climate:updated', payload: state.climate });
}

// Selection
export function selectNode(nodeId: string | null): void {
  state.selectedNodeId = nodeId;
  emit({ type: 'selection:changed', payload: { nodeId } });
}

// Simulation control
export function setPaused(paused: boolean): void {
  state.isPaused = paused;
}

export function setSpeedMultiplier(multiplier: number): void {
  state.speedMultiplier = Math.max(0.1, Math.min(10, multiplier));
}

// Tick
export function incrementTick(): void {
  state.climate.tick++;
  emit({ type: 'tick', payload: { tick: state.climate.tick } });
}

// Helper functions
function getNodeCost(type: NodeType): number {
  switch (type) {
    case 'LEAF':
      return CONFIG.COST_LEAF;
    case 'BRANCH':
      return CONFIG.COST_BRANCH;
    case 'ROOT':
      return CONFIG.COST_ROOT;
    case 'TRUNK':
      return CONFIG.COST_TRUNK;
    default:
      return 0;
  }
}

function getDefaultRadius(type: NodeType): number {
  switch (type) {
    case 'LEAF':
      return CONFIG.LEAF_RADIUS;
    case 'BRANCH':
      return CONFIG.BRANCH_RADIUS;
    case 'ROOT':
      return CONFIG.ROOT_RADIUS;
    case 'TRUNK':
      return CONFIG.TRUNK_RADIUS;
    case 'SEED':
      return CONFIG.SEED_RADIUS;
    default:
      return 0.02;
  }
}

/**
 * Extend a node by inserting a new segment between it and its children.
 * This "pushes" all children one tile further away from the node.
 * The new segment inherits the same type as the original node (TRUNK, BRANCH, ROOT).
 */
export function extendNode(nodeId: string, direction: Vec2): PlantNode | null {
  const node = state.nodes[nodeId];
  if (!node) {
    console.warn(`extendNode: Node ${nodeId} not found`);
    return null;
  }

  // Only extend trunk, branch, or root nodes
  if (node.type !== 'TRUNK' && node.type !== 'BRANCH' && node.type !== 'ROOT') {
    console.warn(`extendNode: Cannot extend ${node.type} nodes`);
    return null;
  }

  // Need sugar to extend
  const cost = getNodeCost(node.type);
  if (state.resources.sugar < cost) {
    console.warn(`extendNode: Not enough sugar (have ${state.resources.sugar}, need ${cost})`);
    return null;
  }

  // Calculate new node position (1 tile in the given direction)
  const tileInMeters = CONFIG.TILE_SIZE / CONFIG.PIXELS_PER_METER;
  const newPosition: Vec2 = {
    x: node.position.x + direction.x * tileInMeters,
    y: node.position.y + direction.y * tileInMeters,
  };

  // Create the new node
  const newNodeId = generateId();
  const newNode: PlantNode = {
    id: newNodeId,
    type: node.type,
    position: newPosition,
    parentId: nodeId,
    childrenIds: [...node.childrenIds], // Take over all children
    radius: node.radius * 0.95, // Slightly thinner
    structuralHealth: 1.0,
    waterPressure: node.waterPressure * 0.98,
    sugarConcentration: node.sugarConcentration * 0.98,
    sugarStore: 0,
    isActive: true,
    stressLevel: 0,
  };

  // Update all children to point to the new node as their parent
  for (const childId of node.childrenIds) {
    const child = state.nodes[childId];
    if (child) {
      child.parentId = newNodeId;
      // Also push child position further in the same direction
      child.position = {
        x: child.position.x + direction.x * tileInMeters,
        y: child.position.y + direction.y * tileInMeters,
      };
    }
  }

  // The original node now only has the new node as its child
  node.childrenIds = [newNodeId];

  // Add new node to state
  state.nodes[newNodeId] = newNode;
  state.resources.sugar -= cost;

  emit({ type: 'node:added', payload: { nodeId: newNodeId, node: newNode } });
  emit({ type: 'resources:changed', payload: state.resources });

  console.log(`Extended ${node.type} at (${node.position.x.toFixed(2)}, ${node.position.y.toFixed(2)}) in direction (${direction.x}, ${direction.y})`);

  return newNode;
}
