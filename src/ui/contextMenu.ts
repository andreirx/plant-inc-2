/**
 * Context Menu - Node action menu.
 *
 * Shows available actions when right-clicking a node:
 * - Grow Leaf (costs sugar)
 * - Extend Branch (costs sugar)
 * - Grow Root (costs sugar)
 * - Harden (increase structural health)
 * - Prune (remove node)
 */

import { getState, addNode, removeNode, updateNode, modifyResources } from '@core/state';
import { CONFIG } from '@core/config';
import type { PlantNode, NodeType, Vec2 } from '@core/types';
import { getChildren } from '@utils/graph';

let menuElement: HTMLElement | null = null;

interface MenuAction {
  label: string;
  cost: number;
  costType: 'sugar' | 'none';
  enabled: boolean;
  action: () => void;
}

/**
 * Initialize the context menu.
 */
export function initContextMenu(): void {
  // Create menu element
  menuElement = document.createElement('div');
  menuElement.id = 'context-menu';
  menuElement.style.cssText = `
    position: fixed;
    display: none;
    background: rgba(30, 30, 40, 0.95);
    border: 1px solid #4fc3f7;
    border-radius: 8px;
    padding: 8px 0;
    min-width: 180px;
    z-index: 1000;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  `;

  document.body.appendChild(menuElement);

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (menuElement && !menuElement.contains(e.target as Node)) {
      hideContextMenu();
    }
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
    }
  });
}

/**
 * Show the context menu for a node at a screen position.
 */
export function showContextMenu(nodeId: string, screenX: number, screenY: number): void {
  if (!menuElement) return;

  const state = getState();
  const node = state.nodes[nodeId];
  if (!node) return;

  // Build menu items based on node type
  const actions = getActionsForNode(node);

  // Clear previous content
  menuElement.innerHTML = '';

  // Header with node info
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 8px 16px;
    border-bottom: 1px solid #333;
    color: #888;
    font-size: 12px;
  `;
  header.textContent = `${node.type} Node`;
  menuElement.appendChild(header);

  // Add menu items
  for (const action of actions) {
    const item = createMenuItem(action);
    menuElement.appendChild(item);
  }

  // Position menu
  const menuWidth = 180;
  const menuHeight = menuElement.offsetHeight || 200;

  let x = screenX + 10;
  let y = screenY;

  // Keep menu on screen
  if (x + menuWidth > window.innerWidth) {
    x = screenX - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }

  menuElement.style.left = `${x}px`;
  menuElement.style.top = `${y}px`;
  menuElement.style.display = 'block';
}

/**
 * Hide the context menu.
 */
export function hideContextMenu(): void {
  if (menuElement) {
    menuElement.style.display = 'none';
  }
}

/**
 * Create a menu item element.
 */
function createMenuItem(action: MenuAction): HTMLElement {
  const item = document.createElement('div');
  item.style.cssText = `
    padding: 10px 16px;
    cursor: ${action.enabled ? 'pointer' : 'not-allowed'};
    color: ${action.enabled ? '#fff' : '#555'};
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.1s;
  `;

  // Label
  const label = document.createElement('span');
  label.textContent = action.label;
  item.appendChild(label);

  // Cost
  if (action.costType !== 'none' && action.cost > 0) {
    const cost = document.createElement('span');
    cost.style.cssText = `
      font-size: 12px;
      color: ${action.enabled ? '#ffd54f' : '#555'};
    `;
    cost.textContent = `${action.cost} `;
    item.appendChild(cost);
  }

  // Hover effect
  if (action.enabled) {
    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(79, 195, 247, 0.2)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });
    item.addEventListener('click', () => {
      action.action();
      hideContextMenu();
    });
  }

  return item;
}

/**
 * Get available actions for a node.
 */
function getActionsForNode(node: PlantNode): MenuAction[] {
  const state = getState();
  const sugar = state.resources.sugar;
  const children = getChildren(state, node);
  const canAddChild = children.length < CONFIG.MAX_CHILDREN_PER_NODE;

  const actions: MenuAction[] = [];

  // Actions depend on node type
  if (node.type === 'SEED') {
    // Seed can grow trunk or roots
    actions.push({
      label: 'Grow Trunk',
      cost: CONFIG.COST_TRUNK,
      costType: 'sugar',
      enabled: sugar >= CONFIG.COST_TRUNK && canAddChild,
      action: () => growNode(node.id, 'TRUNK', -0.3), // Up
    });

    actions.push({
      label: 'Grow Root',
      cost: CONFIG.COST_ROOT,
      costType: 'sugar',
      enabled: sugar >= CONFIG.COST_ROOT && canAddChild,
      action: () => growNode(node.id, 'ROOT', 0.3), // Down
    });
  } else if (node.type === 'TRUNK' || node.type === 'BRANCH') {
    // Trunk/Branch can grow more branches or leaves
    actions.push({
      label: 'Branch Left',
      cost: CONFIG.COST_BRANCH,
      costType: 'sugar',
      enabled: sugar >= CONFIG.COST_BRANCH && canAddChild,
      action: () => growNode(node.id, 'BRANCH', -0.2, -0.3), // Up and left
    });

    actions.push({
      label: 'Branch Right',
      cost: CONFIG.COST_BRANCH,
      costType: 'sugar',
      enabled: sugar >= CONFIG.COST_BRANCH && canAddChild,
      action: () => growNode(node.id, 'BRANCH', -0.2, 0.3), // Up and right
    });

    actions.push({
      label: 'Grow Leaf',
      cost: CONFIG.COST_LEAF,
      costType: 'sugar',
      enabled: sugar >= CONFIG.COST_LEAF && canAddChild,
      action: () => growNode(node.id, 'LEAF', -0.2),
    });

    actions.push({
      label: 'Extend Upward',
      cost: CONFIG.COST_TRUNK,
      costType: 'sugar',
      enabled: sugar >= CONFIG.COST_TRUNK && canAddChild,
      action: () => growNode(node.id, 'TRUNK', -0.4),
    });
  } else if (node.type === 'ROOT') {
    // Roots can extend or fork
    actions.push({
      label: 'Extend Root',
      cost: CONFIG.COST_ROOT,
      costType: 'sugar',
      enabled: sugar >= CONFIG.COST_ROOT && canAddChild,
      action: () => growNode(node.id, 'ROOT', 0.3),
    });

    actions.push({
      label: 'Fork Root',
      cost: CONFIG.COST_ROOT,
      costType: 'sugar',
      enabled: sugar >= CONFIG.COST_ROOT && canAddChild,
      action: () => {
        growNode(node.id, 'ROOT', 0.3, -0.3);
        growNode(node.id, 'ROOT', 0.3, 0.3);
      },
    });
  }

  // Common actions
  if (node.type !== 'SEED') {
    actions.push({
      label: 'Harden',
      cost: CONFIG.COST_HARDEN,
      costType: 'sugar',
      enabled: sugar >= CONFIG.COST_HARDEN && node.structuralHealth < 1,
      action: () => hardenNode(node.id),
    });

    actions.push({
      label: 'Prune',
      cost: 0,
      costType: 'none',
      enabled: true,
      action: () => pruneNode(node.id),
    });
  }

  return actions;
}

/**
 * Grow a new node from a parent.
 * Positions are grid-aligned for proper tile rendering.
 * One tile = TILE_SIZE / PIXELS_PER_METER = 0.25 meters
 */
function growNode(parentId: string, type: NodeType, yOffset: number, xOffset: number = 0): void {
  const state = getState();
  const parent = state.nodes[parentId];
  if (!parent) return;

  // Grid size in meters (one tile)
  const gridSize = CONFIG.TILE_SIZE / CONFIG.PIXELS_PER_METER; // 0.25m

  // Calculate new position with grid alignment
  // Use at least 2 tiles (0.5m) spacing for visibility
  const spacing = gridSize * 2; // 0.5 meters = 2 tiles

  let newX = parent.position.x;
  let newY = parent.position.y;

  // Apply direction
  if (yOffset < 0) {
    // Growing upward
    newY -= spacing;
  } else if (yOffset > 0) {
    // Growing downward
    newY += spacing;
  }

  if (xOffset < 0) {
    // Growing left
    newX -= spacing;
  } else if (xOffset > 0) {
    // Growing right
    newX += spacing;
  }

  // Snap to grid
  newX = Math.round(newX / gridSize) * gridSize;
  newY = Math.round(newY / gridSize) * gridSize;

  const newPosition: Vec2 = { x: newX, y: newY };
  addNode(parentId, type, newPosition);
}

/**
 * Harden a node (increase structural health).
 */
function hardenNode(nodeId: string): void {
  const state = getState();
  const node = state.nodes[nodeId];
  if (!node) return;

  if (state.resources.sugar >= CONFIG.COST_HARDEN) {
    modifyResources({ sugar: -CONFIG.COST_HARDEN });
    updateNode(nodeId, {
      structuralHealth: Math.min(1, node.structuralHealth + 0.2),
      radius: node.radius * 1.1, // Slightly thicker
    });
  }
}

/**
 * Prune (remove) a node.
 */
function pruneNode(nodeId: string): void {
  removeNode(nodeId);
}

/**
 * Clean up the context menu.
 */
export function destroyContextMenu(): void {
  if (menuElement) {
    menuElement.remove();
    menuElement = null;
  }
}
