/**
 * Input System - Mouse/touch handling for plant interaction.
 *
 * LEFT CLICK on node: Show growth options
 * LEFT CLICK on growth highlight: Grow in that direction
 * LEFT CLICK elsewhere: Deselect
 * MIDDLE MOUSE drag: Pan camera
 * MOUSE WHEEL: Zoom
 */

import { getApp, screenToWorld, panCamera, setCameraZoom, getCameraZoom } from '@render/app';
import { getState, selectNode } from '@core/state';
import { distance } from '@utils/vector';
import type { PlantNode, Vec2 } from '@core/types';
import {
  showGrowthOptions,
  hideGrowthOptions,
  getGrowthOptionAtPosition,
  getSelectedNodeId,
} from '@render/layers/growthHighlights';

let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

/**
 * Initialize input handling.
 */
export function initInput(): void {
  const app = getApp();
  if (!app) return;

  const canvas = app.canvas;

  // Mouse events
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  // Touch events
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
}

/**
 * Mouse down handler.
 */
function onMouseDown(e: MouseEvent): void {
  if (e.button === 1) {
    // Middle mouse - start panning
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    e.preventDefault();
  } else if (e.button === 0) {
    // Left click - interact
    handleClick(e.clientX, e.clientY);
  }
}

/**
 * Mouse move handler.
 */
function onMouseMove(e: MouseEvent): void {
  if (isDragging) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    panCamera(-dx, -dy);
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }
}

/**
 * Mouse up handler.
 */
function onMouseUp(e: MouseEvent): void {
  if (e.button === 1) {
    isDragging = false;
  }
}

/**
 * Mouse wheel handler.
 */
function onWheel(e: WheelEvent): void {
  e.preventDefault();

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = getCameraZoom() * zoomFactor;
  setCameraZoom(newZoom);
}

/**
 * Context menu (right-click) handler - just prevent default.
 */
function onContextMenu(e: MouseEvent): void {
  e.preventDefault();
}

/**
 * Touch start handler.
 */
function onTouchStart(e: TouchEvent): void {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    lastMouseX = touch.clientX;
    lastMouseY = touch.clientY;
  } else if (e.touches.length === 2) {
    // Start pinch zoom
    e.preventDefault();
  }
}

/**
 * Touch move handler.
 */
function onTouchMove(e: TouchEvent): void {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    const dx = touch.clientX - lastMouseX;
    const dy = touch.clientY - lastMouseY;

    // Pan if moving significantly
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      isDragging = true;
      panCamera(-dx, -dy);
    }

    lastMouseX = touch.clientX;
    lastMouseY = touch.clientY;
  } else if (e.touches.length === 2) {
    // Pinch zoom
    e.preventDefault();
  }
}

/**
 * Touch end handler.
 */
function onTouchEnd(e: TouchEvent): void {
  if (!isDragging && e.changedTouches.length === 1) {
    // Tap - treat as click
    const touch = e.changedTouches[0];
    handleClick(touch.clientX, touch.clientY);
  }
  isDragging = false;
}

/**
 * Handle a click at screen coordinates.
 */
function handleClick(screenX: number, screenY: number): void {
  // Convert to world coordinates
  const worldPos = screenToWorld(screenX, screenY);

  // First check if clicking on a growth highlight
  const growthOption = getGrowthOptionAtPosition(worldPos);
  if (growthOption) {
    // Growth highlights handle their own click events via PixiJS
    // But if we get here, the click wasn't caught by the graphics
    return;
  }

  // Find nearest node
  const hitNode = findNearestNode(worldPos);

  if (hitNode) {
    const currentSelection = getSelectedNodeId();

    if (currentSelection === hitNode.id) {
      // Clicking same node - deselect
      selectNode(null);
      hideGrowthOptions();
    } else {
      // Select new node and show growth options
      selectNode(hitNode.id);
      showGrowthOptions(hitNode.id);
    }
  } else {
    // Clicked on empty space - deselect
    selectNode(null);
    hideGrowthOptions();
  }
}

/**
 * Find the nearest node to a world position.
 * Returns null if no node is within interaction range.
 */
function findNearestNode(worldPos: Vec2): PlantNode | null {
  const state = getState();
  const maxDistance = 2.0; // Maximum click distance in meters

  let nearestNode: PlantNode | null = null;
  let nearestDist = Infinity;

  for (const node of Object.values(state.nodes)) {
    const dist = distance(worldPos, node.position);

    // Use generous hit radius for tile-based display
    const hitRadius = Math.max(node.radius * 8, 0.5);

    if (dist < hitRadius && dist < nearestDist) {
      nearestNode = node;
      nearestDist = dist;
    }
  }

  // Only return if within max distance
  if (nearestDist <= maxDistance) {
    return nearestNode;
  }

  return null;
}

/**
 * Check if a node is at a screen position.
 */
export function getNodeAtScreenPosition(screenX: number, screenY: number): PlantNode | null {
  const worldPos = screenToWorld(screenX, screenY);
  return findNearestNode(worldPos);
}

/**
 * Clean up input handling.
 */
export function destroyInput(): void {
  const app = getApp();
  if (!app) return;

  const canvas = app.canvas;

  canvas.removeEventListener('mousedown', onMouseDown);
  canvas.removeEventListener('mousemove', onMouseMove);
  canvas.removeEventListener('mouseup', onMouseUp);
  canvas.removeEventListener('wheel', onWheel);
  canvas.removeEventListener('contextmenu', onContextMenu);
  canvas.removeEventListener('touchstart', onTouchStart);
  canvas.removeEventListener('touchmove', onTouchMove);
  canvas.removeEventListener('touchend', onTouchEnd);
}
