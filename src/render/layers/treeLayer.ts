/**
 * Tree Layer - Autotile-based cross-section rendering of the plant.
 *
 * Uses marching squares approach with 16 tile variants.
 * Each tile shows internal structure with:
 * - Bark on non-connected edges (boundary)
 * - Vessel channels (xylem/phloem) on connected edges
 *
 * Connectivity determines which tile variant to use:
 * - tree_NSEW.png where each letter is 1 (connected) or 0 (not connected)
 * - Example: tree_1100.png = connected North and South (vertical segment)
 */

import { Container, Sprite, Graphics } from 'pixi.js';
import { getState } from '@core/state';
import { CONFIG } from '@core/config';
import type { PlantNode } from '@core/types';
import { getTreeTile, getTexture } from '../assetManager';

// Grid cell tracking
interface GridCell {
  x: number;
  y: number;
  nodeId?: string; // Optional: track which node this cell belongs to
}

let treeContainer: Container | null = null;
let tileSprites: Map<string, Sprite> = new Map();
let branchMarkers: Graphics | null = null;

/**
 * Initialize the tree layer.
 */
export function initTreeLayer(container: Container): void {
  treeContainer = new Container();
  container.addChild(treeContainer);

  // Create graphics layer for branch markers (drawn on top of tiles)
  branchMarkers = new Graphics();
  treeContainer.addChild(branchMarkers);

  updateTreeLayer();
}

/**
 * Update the tree layer each frame.
 */
export function updateTreeLayer(): void {
  if (!treeContainer) return;

  const state = getState();

  // Build set of occupied grid cells
  const occupiedCells = buildOccupiedCells(state.nodes);

  // Track which tile keys we've seen
  const seenKeys = new Set<string>();

  // Create/update sprites for each occupied cell
  for (const [key, cell] of occupiedCells) {
    seenKeys.add(key);

    // Determine NSEW connectivity by checking neighbors
    const hasN = occupiedCells.has(`${cell.x},${cell.y - 1}`);
    const hasS = occupiedCells.has(`${cell.x},${cell.y + 1}`);
    const hasE = occupiedCells.has(`${cell.x + 1},${cell.y}`);
    const hasW = occupiedCells.has(`${cell.x - 1},${cell.y}`);

    // Get appropriate tile texture
    const texture = getTreeTile(hasN, hasS, hasE, hasW);

    let sprite = tileSprites.get(key);
    if (!sprite) {
      sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      tileSprites.set(key, sprite);
      treeContainer.addChild(sprite);
    } else {
      sprite.texture = texture;
    }

    // Position in world coordinates
    sprite.x = cell.x * CONFIG.TILE_SIZE;
    sprite.y = cell.y * CONFIG.TILE_SIZE;
    sprite.width = CONFIG.TILE_SIZE;
    sprite.height = CONFIG.TILE_SIZE;
  }

  // Also render seed and leaf nodes with their special tiles
  for (const node of Object.values(state.nodes)) {
    const gridX = Math.round((node.position.x * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
    const gridY = Math.round((node.position.y * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
    const key = `special_${gridX},${gridY}`;

    if (node.type === 'SEED') {
      seenKeys.add(key);
      let sprite = tileSprites.get(key);
      if (!sprite) {
        sprite = new Sprite(getTexture('seed'));
        sprite.anchor.set(0.5);
        tileSprites.set(key, sprite);
        treeContainer.addChild(sprite);
      }
      sprite.x = gridX * CONFIG.TILE_SIZE;
      sprite.y = gridY * CONFIG.TILE_SIZE;
      sprite.width = CONFIG.TILE_SIZE;
      sprite.height = CONFIG.TILE_SIZE;
    } else if (node.type === 'LEAF') {
      seenKeys.add(key);
      let sprite = tileSprites.get(key);
      if (!sprite) {
        sprite = new Sprite(getTexture('leaf'));
        sprite.anchor.set(0.5);
        tileSprites.set(key, sprite);
        treeContainer.addChild(sprite);
      }
      sprite.x = gridX * CONFIG.TILE_SIZE;
      sprite.y = gridY * CONFIG.TILE_SIZE;
      sprite.width = CONFIG.TILE_SIZE;
      sprite.height = CONFIG.TILE_SIZE;
    }
  }

  // Remove sprites for tiles no longer needed
  for (const [key, sprite] of tileSprites) {
    if (!seenKeys.has(key)) {
      treeContainer.removeChild(sprite);
      sprite.destroy();
      tileSprites.delete(key);
    }
  }

  // Draw branch markers to clarify tree structure
  // Ensure markers are on top by re-adding to container
  if (branchMarkers && treeContainer) {
    treeContainer.removeChild(branchMarkers);
    treeContainer.addChild(branchMarkers);
  }
  drawBranchMarkers(state.nodes);
}

/**
 * Build a map of all grid cells occupied by tree segments.
 * This includes:
 * - Cells at each node position
 * - Cells along paths between connected nodes
 */
function buildOccupiedCells(nodes: Record<string, PlantNode>): Map<string, GridCell> {
  const cells = new Map<string, GridCell>();
  let nodeCount = 0;

  // Helper to add a cell
  const addCell = (x: number, y: number, nodeId?: string): void => {
    const key = `${x},${y}`;
    if (!cells.has(key)) {
      cells.set(key, { x, y, nodeId });
    }
  };

  // Process each node
  for (const node of Object.values(nodes)) {
    nodeCount++;

    // Convert world position to grid position
    const gridX = Math.round((node.position.x * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
    const gridY = Math.round((node.position.y * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);

    // Skip seed and leaf for cell placement (they use special tiles)
    // But still draw paths FROM them to their parents
    if (node.type !== 'SEED' && node.type !== 'LEAF') {
      // Add cell at node position
      addCell(gridX, gridY, node.id);
    }

    // Draw path from this node to its parent (for ALL node types except seed)
    if (node.parentId && node.type !== 'SEED') {
      const parent = nodes[node.parentId];
      if (parent) {
        const parentGridX = Math.round((parent.position.x * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
        const parentGridY = Math.round((parent.position.y * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);

        // Fill in cells along the path using Bresenham-style line
        fillPathCells(addCell, gridX, gridY, parentGridX, parentGridY);
      }
    }
  }

  // Debug: log cell count occasionally
  if (cells.size > 0 && Math.random() < 0.01) {
    console.log(`buildOccupiedCells: ${nodeCount} nodes -> ${cells.size} cells`);
  }

  return cells;
}

/**
 * Fill cells along a path between two grid points.
 * Uses a simple line algorithm that fills all cells the path passes through.
 */
function fillPathCells(
  addCell: (x: number, y: number) => void,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let x = x0;
  let y = y0;

  if (dx === 0 && dy === 0) {
    // Same cell
    addCell(x, y);
    return;
  }

  // Use step-based approach for cleaner paths
  if (dx >= dy) {
    // Horizontal-ish path
    let err = dx / 2;
    while (x !== x1) {
      addCell(x, y);
      err -= dy;
      if (err < 0) {
        y += sy;
        err += dx;
      }
      x += sx;
    }
    addCell(x1, y1);
  } else {
    // Vertical-ish path
    let err = dy / 2;
    while (y !== y1) {
      addCell(x, y);
      err -= dx;
      if (err < 0) {
        x += sx;
        err += dy;
      }
      y += sy;
    }
    addCell(x1, y1);
  }
}

/**
 * Get the sprite at a specific tile position (for hit testing).
 */
export function getTileAt(gridX: number, gridY: number): Sprite | undefined {
  return tileSprites.get(`${gridX},${gridY}`);
}

/**
 * Convert screen coordinates to grid coordinates.
 */
export function screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
  return {
    x: Math.floor(screenX / CONFIG.TILE_SIZE),
    y: Math.floor(screenY / CONFIG.TILE_SIZE),
  };
}

/**
 * Get the node sprite for a specific node (legacy compatibility).
 * Returns the tile sprite at the node's grid position.
 */
export function getNodeSprite(nodeId: string): Sprite | undefined {
  const state = getState();
  const node = state.nodes[nodeId];
  if (!node) return undefined;

  const gridX = Math.round((node.position.x * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
  const gridY = Math.round((node.position.y * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);

  // Check for special tile first
  const specialKey = `special_${gridX},${gridY}`;
  if (tileSprites.has(specialKey)) {
    return tileSprites.get(specialKey);
  }

  return tileSprites.get(`${gridX},${gridY}`);
}

/**
 * Draw visual markers at branch points to clarify tree structure.
 * Shows bright colored rings at nodes where branching occurs.
 */
function drawBranchMarkers(nodes: Record<string, PlantNode>): void {
  if (!branchMarkers) return;

  branchMarkers.clear();

  const markerSize = CONFIG.TILE_SIZE * 0.2;

  for (const node of Object.values(nodes)) {
    if (!node.isActive) continue;

    const gridX = Math.round((node.position.x * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
    const gridY = Math.round((node.position.y * CONFIG.PIXELS_PER_METER) / CONFIG.TILE_SIZE);
    const pixelX = gridX * CONFIG.TILE_SIZE;
    const pixelY = gridY * CONFIG.TILE_SIZE;

    // Draw marker at branch points (nodes with multiple children)
    if (node.childrenIds.length > 1) {
      // Branch point - bright yellow ring
      branchMarkers.circle(pixelX, pixelY, markerSize * 1.8);
      branchMarkers.stroke({ color: 0xffcc00, width: 3, alpha: 0.9 });
      branchMarkers.circle(pixelX, pixelY, markerSize);
      branchMarkers.fill({ color: 0xffcc00, alpha: 0.8 });
    }
  }
}

/**
 * Clean up the tree layer.
 */
export function destroyTreeLayer(): void {
  if (treeContainer) {
    treeContainer.destroy({ children: true });
    treeContainer = null;
  }
  tileSprites.clear();
  branchMarkers = null;
}
