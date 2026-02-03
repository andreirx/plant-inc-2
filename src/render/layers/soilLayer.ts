/**
 * Soil Layer - Renders the underground terrain.
 *
 * Uses tiled sprites to create a dirt/clay/rock background.
 * Surface layer is distinct from deeper layers.
 * Slight color variation per tile for geological interest.
 */

import { Container, Graphics } from 'pixi.js';
import { getCanvasSize, getGroundLevelY } from '../app';
import { CONFIG } from '@core/config';
import { getState } from '@core/state';

let soilContainer: Container | null = null;
let soilGraphics: Graphics | null = null;
let moistureOverlay: Graphics | null = null;

/**
 * Initialize the soil layer.
 */
export function initSoilLayer(container: Container): void {
  soilContainer = new Container();
  container.addChild(soilContainer);

  // Main soil graphics
  soilGraphics = new Graphics();
  soilContainer.addChild(soilGraphics);

  // Moisture overlay (shows wet areas)
  moistureOverlay = new Graphics();
  soilContainer.addChild(moistureOverlay);

  // Initial draw
  updateSoilLayer();
}

/**
 * Update the soil layer each frame.
 */
export function updateSoilLayer(): void {
  if (!soilGraphics) return;

  const { width, height } = getCanvasSize();
  void getGroundLevelY(); // Ground level reference
  const state = getState();

  soilGraphics.clear();

  // Soil fills the bottom half of the screen (below ground level)
  // We draw in world coordinates, so Y=0 is ground level

  // Background fill - base soil color
  const soilHeight = height; // Extend well below visible area

  // Draw soil layers with depth-based coloring
  const layers = 8;
  const layerHeight = soilHeight / layers;

  for (let i = 0; i < layers; i++) {
    const depth = i / layers;
    const y = i * layerHeight;

    // Color gets darker with depth
    const baseColor = i === 0 ? CONFIG.COLOR_SOIL_SURFACE : CONFIG.COLOR_SOIL_DEEP;
    const depthFactor = 1 - depth * 0.3;
    const color = darkenColor(baseColor, depthFactor);

    soilGraphics.rect(-width, y, width * 3, layerHeight);
    soilGraphics.fill(color);

    // Add some texture variation
    addSoilTexture(soilGraphics, -width, y, width * 3, layerHeight, i);
  }

  // Ground surface line
  soilGraphics.moveTo(-width, 0);
  soilGraphics.lineTo(width * 2, 0);
  soilGraphics.stroke({ color: 0x2d1f14, width: 3 });

  // Grass tufts on surface
  drawGrassTufts(soilGraphics, width);

  // Update moisture overlay
  if (moistureOverlay) {
    moistureOverlay.clear();

    // Show soil moisture level
    const moisture = state.climate.soilWater;
    if (moisture > 0.3) {
      // Wet soil appears darker
      const alpha = (moisture - 0.3) * 0.5;
      moistureOverlay.rect(-width, 0, width * 3, height);
      moistureOverlay.fill({ color: 0x000000, alpha: alpha * 0.2 });
    }
  }
}

/**
 * Add texture details to a soil layer.
 */
function addSoilTexture(
  gfx: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  layerIndex: number
): void {
  const rng = mulberry32(layerIndex * 1000 + 42);

  // Random pebbles/rocks
  const rockCount = Math.floor(w / 100);
  for (let i = 0; i < rockCount; i++) {
    const rx = x + rng() * w;
    const ry = y + rng() * h;
    const rw = 2 + rng() * 6;
    const rh = 2 + rng() * 4;

    const rockColor = layerIndex < 3 ? 0x666666 : 0x555555;
    gfx.ellipse(rx, ry, rw, rh);
    gfx.fill({ color: rockColor, alpha: 0.4 });
  }

  // Occasional roots (visual only, not gameplay roots)
  if (layerIndex > 0 && layerIndex < 5) {
    const rootCount = Math.floor(rng() * 3);
    for (let i = 0; i < rootCount; i++) {
      const startX = x + rng() * w;
      const startY = y + rng() * h;
      const endX = startX + (rng() - 0.5) * 40;
      const endY = startY + rng() * 20;

      gfx.moveTo(startX, startY);
      gfx.quadraticCurveTo(
        startX + (endX - startX) * 0.5 + (rng() - 0.5) * 10,
        startY + (endY - startY) * 0.3,
        endX,
        endY
      );
      gfx.stroke({ color: 0x4a3728, width: 1, alpha: 0.3 });
    }
  }

  // Clay/mineral streaks in deeper layers
  if (layerIndex > 3) {
    const streakCount = Math.floor(rng() * 2);
    for (let i = 0; i < streakCount; i++) {
      const sx = x + rng() * w;
      const sy = y + h * 0.3 + rng() * h * 0.4;
      const sw = 30 + rng() * 60;
      const sh = 2 + rng() * 3;

      gfx.ellipse(sx, sy, sw, sh);
      gfx.fill({ color: 0x8b7355, alpha: 0.2 });
    }
  }
}

/**
 * Draw grass tufts at ground level.
 */
function drawGrassTufts(gfx: Graphics, screenWidth: number): void {
  const rng = mulberry32(999);
  const tufts = Math.floor(screenWidth / 20);

  for (let i = 0; i < tufts; i++) {
    const x = (i / tufts) * screenWidth * 2 - screenWidth;
    const bladeCount = 2 + Math.floor(rng() * 4);

    for (let j = 0; j < bladeCount; j++) {
      const bx = x + (rng() - 0.5) * 10;
      const bladeHeight = 4 + rng() * 8;
      const bendX = (rng() - 0.5) * 4;

      gfx.moveTo(bx, 0);
      gfx.quadraticCurveTo(bx + bendX * 0.5, -bladeHeight * 0.5, bx + bendX, -bladeHeight);
      gfx.stroke({ color: 0x3d5c3d, width: 1, alpha: 0.6 });
    }
  }
}

/**
 * Darken a color by a factor.
 */
function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/**
 * Seeded PRNG.
 */
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Clean up the soil layer.
 */
export function destroySoilLayer(): void {
  if (soilContainer) {
    soilContainer.destroy({ children: true });
    soilContainer = null;
  }
  soilGraphics = null;
  moistureOverlay = null;
}
