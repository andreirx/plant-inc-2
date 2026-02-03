/**
 * Growth Highlights Layer - Visual indicators for possible growth directions.
 *
 * When a node is selected, shows highlighted grid cells where new nodes can grow.
 * Clicking on a highlight grows the plant in that direction.
 */

import { Container, Graphics } from 'pixi.js';
import { getState, addNode, updateNode, extendNode } from '@core/state';
import { CONFIG } from '@core/config';
import type { PlantNode, NodeType, Vec2 } from '@core/types';
import { getChildren } from '@utils/graph';

type GrowthType = NodeType | 'THICKEN' | 'EXTEND';

interface GrowthOption {
  gridX: number;
  gridY: number;
  worldPos: Vec2;
  type: GrowthType;
  cost: number;
  label: string;
  isSpecial?: boolean; // For non-growth actions like THICKEN, EXTEND
  direction?: Vec2; // Direction for EXTEND action
}

let highlightContainer: Container | null = null;
let currentHighlights: GrowthOption[] = [];
let highlightGraphics: Graphics[] = [];
let selectedNodeId: string | null = null;

/**
 * Initialize the growth highlights layer.
 */
export function initGrowthHighlightsLayer(container: Container): void {
  highlightContainer = new Container();
  container.addChild(highlightContainer);
}

/**
 * Show growth options for a selected node.
 */
export function showGrowthOptions(nodeId: string): void {
  if (!highlightContainer) return;

  const state = getState();
  const node = state.nodes[nodeId];
  if (!node) return;

  selectedNodeId = nodeId;

  // Clear previous highlights
  clearHighlights();

  // Calculate growth options based on node type
  currentHighlights = calculateGrowthOptions(node, state);

  // Create visual highlights
  for (const option of currentHighlights) {
    const gfx = new Graphics();

    // Draw highlight square
    const size = CONFIG.TILE_SIZE * 0.9;
    gfx.roundRect(-size / 2, -size / 2, size, size, 8);

    // Color based on type
    const color = getHighlightColor(option.type);
    gfx.fill({ color, alpha: 0.3 });
    gfx.stroke({ color, width: 2, alpha: 0.8 });

    // Position
    gfx.x = option.gridX * CONFIG.TILE_SIZE;
    gfx.y = option.gridY * CONFIG.TILE_SIZE;

    // Make interactive
    gfx.eventMode = 'static';
    gfx.cursor = 'pointer';

    // Hover effect
    gfx.on('pointerover', () => {
      gfx.clear();
      gfx.roundRect(-size / 2, -size / 2, size, size, 8);
      gfx.fill({ color, alpha: 0.5 });
      gfx.stroke({ color, width: 3, alpha: 1 });
    });

    gfx.on('pointerout', () => {
      gfx.clear();
      gfx.roundRect(-size / 2, -size / 2, size, size, 8);
      gfx.fill({ color, alpha: 0.3 });
      gfx.stroke({ color, width: 2, alpha: 0.8 });
    });

    // Click to grow
    gfx.on('pointerdown', () => {
      executeGrowth(option);
    });

    highlightContainer.addChild(gfx);
    highlightGraphics.push(gfx);
  }
}

/**
 * Hide all growth highlights.
 */
export function hideGrowthOptions(): void {
  clearHighlights();
  selectedNodeId = null;
  currentHighlights = [];
}

/**
 * Clear highlight graphics.
 */
function clearHighlights(): void {
  for (const gfx of highlightGraphics) {
    gfx.destroy();
  }
  highlightGraphics = [];
  if (highlightContainer) {
    highlightContainer.removeChildren();
  }
}

/**
 * Calculate possible growth options for a node.
 */
function calculateGrowthOptions(node: PlantNode, state: ReturnType<typeof getState>): GrowthOption[] {
  const options: GrowthOption[] = [];
  const children = getChildren(state, node);
  const canAddChild = children.length < CONFIG.MAX_CHILDREN_PER_NODE;

  if (!canAddChild) return options;

  // Convert node position to grid
  const nodeGridX = Math.round((node.position.x * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
  const nodeGridY = Math.round((node.position.y * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);

  // Get occupied positions to avoid collisions
  const occupied = new Set<string>();
  for (const n of Object.values(state.nodes)) {
    const gx = Math.round((n.position.x * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
    const gy = Math.round((n.position.y * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
    occupied.add(`${gx},${gy}`);
  }

  // Helper to add option if position is free
  const addOption = (dx: number, dy: number, type: NodeType, cost: number, label: string) => {
    const gridX = nodeGridX + dx;
    const gridY = nodeGridY + dy;
    const key = `${gridX},${gridY}`;

    if (!occupied.has(key) && state.resources.sugar >= cost) {
      options.push({
        gridX,
        gridY,
        worldPos: {
          x: (gridX * CONFIG.TILE_SIZE) / CONFIG.PIXELS_PER_METER,
          y: (gridY * CONFIG.TILE_SIZE) / CONFIG.PIXELS_PER_METER,
        },
        type,
        cost,
        label,
      });
    }
  };

  // Options depend on node type - use 1-tile offsets so every tile can have a node
  if (node.type === 'SEED') {
    // Seed can grow trunk (up) or root (down)
    addOption(0, -1, 'TRUNK', CONFIG.COST_TRUNK, 'Trunk');
    addOption(0, 1, 'ROOT', CONFIG.COST_ROOT, 'Root');
  } else if (node.type === 'TRUNK' || node.type === 'BRANCH') {
    // Trunk/Branch can grow up, left, right, or add leaf
    addOption(0, -1, 'TRUNK', CONFIG.COST_TRUNK, 'Up');
    addOption(-1, -1, 'BRANCH', CONFIG.COST_BRANCH, 'Up-Left');
    addOption(1, -1, 'BRANCH', CONFIG.COST_BRANCH, 'Up-Right');
    addOption(-1, 0, 'BRANCH', CONFIG.COST_BRANCH, 'Left');
    addOption(1, 0, 'BRANCH', CONFIG.COST_BRANCH, 'Right');
    addOption(0, -1, 'LEAF', CONFIG.COST_LEAF, 'Leaf');
  } else if (node.type === 'ROOT') {
    // Roots can extend down or fork diagonally
    addOption(0, 1, 'ROOT', CONFIG.COST_ROOT, 'Down');
    addOption(-1, 1, 'ROOT', CONFIG.COST_ROOT, 'Down-Left');
    addOption(1, 1, 'ROOT', CONFIG.COST_ROOT, 'Down-Right');
    addOption(-1, 0, 'ROOT', CONFIG.COST_ROOT, 'Left');
    addOption(1, 0, 'ROOT', CONFIG.COST_ROOT, 'Right');
  } else if (node.type === 'LEAF') {
    // Leaves can grow more leaves or branches from their position
    addOption(0, -1, 'LEAF', CONFIG.COST_LEAF, 'Up');
    addOption(-1, 0, 'BRANCH', CONFIG.COST_BRANCH, 'Left');
    addOption(1, 0, 'BRANCH', CONFIG.COST_BRANCH, 'Right');
  }

  // Add THICKEN option for trunk/branch/root nodes (not leaves or seed)
  if (node.type === 'TRUNK' || node.type === 'BRANCH' || node.type === 'ROOT') {
    // Only offer thicken if sugar is available
    if (state.resources.sugar >= CONFIG.COST_HARDEN) {
      options.push({
        gridX: nodeGridX,
        gridY: nodeGridY,
        worldPos: node.position,
        type: 'THICKEN',
        cost: CONFIG.COST_HARDEN,
        label: 'Thicken',
        isSpecial: true,
      });
    }
  }

  // Add EXTEND option for trunk/branch/root nodes with children
  // This pushes all children further away, elongating the stem
  if (node.type === 'TRUNK' || node.type === 'BRANCH' || node.type === 'ROOT') {
    if (node.childrenIds.length > 0) {
      const extendCost = node.type === 'ROOT' ? CONFIG.COST_ROOT : CONFIG.COST_TRUNK;
      if (state.resources.sugar >= extendCost) {
        // Determine extension direction based on node type
        // Trunks/branches extend upward, roots extend downward
        const extendDir: Vec2 = node.type === 'ROOT' ? { x: 0, y: 1 } : { x: 0, y: -1 };
        const extendGridX = nodeGridX + extendDir.x;
        const extendGridY = nodeGridY + extendDir.y;
        const extendKey = `${extendGridX},${extendGridY}`;

        // Only offer if the extension position is free
        if (!occupied.has(extendKey)) {
          options.push({
            gridX: extendGridX,
            gridY: extendGridY,
            worldPos: {
              x: (extendGridX * CONFIG.TILE_SIZE) / CONFIG.PIXELS_PER_METER,
              y: (extendGridY * CONFIG.TILE_SIZE) / CONFIG.PIXELS_PER_METER,
            },
            type: 'EXTEND',
            cost: extendCost,
            label: 'Extend',
            isSpecial: true,
            direction: extendDir,
          });
        }
      }
    }
  }

  return options;
}

/**
 * Execute a growth action.
 */
function executeGrowth(option: GrowthOption): void {
  if (!selectedNodeId) return;

  const state = getState();
  if (state.resources.sugar < option.cost) {
    console.log('Not enough sugar');
    return;
  }

  // Handle special THICKEN action
  if (option.type === 'THICKEN') {
    const node = state.nodes[selectedNodeId];
    if (node) {
      // Increase radius by 20%
      const newRadius = node.radius * 1.2;
      updateNode(selectedNodeId, { radius: newRadius });
      // Deduct cost manually (addNode does this automatically)
      state.resources.sugar -= option.cost;
      console.log(`Thickened ${node.type} to radius ${newRadius.toFixed(3)}`);
      showGrowthOptions(selectedNodeId);
    }
    return;
  }

  // Handle special EXTEND action
  if (option.type === 'EXTEND' && option.direction) {
    const newNode = extendNode(selectedNodeId, option.direction);
    if (newNode) {
      console.log(`Extended node, created ${newNode.type} at (${newNode.position.x.toFixed(2)}, ${newNode.position.y.toFixed(2)})`);
      showGrowthOptions(selectedNodeId);
    }
    return;
  }

  // Add the new node (for normal growth types)
  const newNode = addNode(selectedNodeId, option.type as NodeType, option.worldPos);

  if (newNode) {
    console.log(`Grew ${option.type} at (${option.worldPos.x.toFixed(2)}, ${option.worldPos.y.toFixed(2)})`);
    // Show new options for the parent node
    showGrowthOptions(selectedNodeId);
  }
}

/**
 * Get highlight color based on node type.
 */
function getHighlightColor(type: GrowthType): number {
  switch (type) {
    case 'TRUNK':
      return 0x8b4513; // Brown
    case 'BRANCH':
      return 0x654321; // Dark brown
    case 'LEAF':
      return 0x228b22; // Green
    case 'ROOT':
      return 0xd2691e; // Chocolate
    case 'THICKEN':
      return 0xffd700; // Gold - stands out as special action
    case 'EXTEND':
      return 0x00ffff; // Cyan - distinct color for extend action
    default:
      return 0xffffff;
  }
}

/**
 * Check if a world position is on a growth highlight.
 * Returns the option if found, null otherwise.
 */
export function getGrowthOptionAtPosition(worldPos: Vec2): GrowthOption | null {
  const clickGridX = Math.round((worldPos.x * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
  const clickGridY = Math.round((worldPos.y * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);

  for (const option of currentHighlights) {
    if (option.gridX === clickGridX && option.gridY === clickGridY) {
      return option;
    }
  }

  return null;
}

/**
 * Get the currently selected node ID.
 */
export function getSelectedNodeId(): string | null {
  return selectedNodeId;
}

/**
 * Check if there are any active highlights.
 */
export function hasActiveHighlights(): boolean {
  return currentHighlights.length > 0;
}

/**
 * Clean up the growth highlights layer.
 */
export function destroyGrowthHighlightsLayer(): void {
  clearHighlights();
  if (highlightContainer) {
    highlightContainer.destroy({ children: true });
    highlightContainer = null;
  }
}
