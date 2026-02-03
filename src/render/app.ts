/**
 * PixiJS Application Setup.
 *
 * Creates the main application, camera container, and layer structure.
 * The canvas is split into two regions:
 * - Top half: Sky (above ground)
 * - Bottom half: Soil (below ground)
 * Ground level is at the exact center.
 */

import { Application, Container } from 'pixi.js';
import { CONFIG } from '@core/config';

let app: Application | null = null;
let worldContainer: Container | null = null;
let cameraX = 0;
let cameraY = 0;
let cameraZoom = 1;

/** Layer containers in render order (back to front) */
export interface RenderLayers {
  background: Container;
  soil: Container;
  tree: Container;
  highlights: Container;
  particles: Container;
  ui: Container;
}

let layers: RenderLayers | null = null;

/**
 * Initialize the PixiJS application.
 */
export async function initRenderer(container: HTMLElement): Promise<Application> {
  app = new Application();

  await app.init({
    background: 0x1a1a2e,
    resizeTo: container,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.appendChild(app.canvas);

  // Create world container for camera transforms
  worldContainer = new Container();
  app.stage.addChild(worldContainer);

  // Create layer containers
  layers = {
    background: new Container(),
    soil: new Container(),
    tree: new Container(),
    highlights: new Container(),
    particles: new Container(),
    ui: new Container(),
  };

  // Add layers in order
  worldContainer.addChild(layers.background);
  worldContainer.addChild(layers.soil);
  worldContainer.addChild(layers.tree);
  worldContainer.addChild(layers.highlights);
  worldContainer.addChild(layers.particles);

  // UI is not affected by camera
  app.stage.addChild(layers.ui);

  // Center camera on ground level
  centerCamera();

  // Handle resize
  window.addEventListener('resize', () => {
    centerCamera();
  });

  return app;
}

/**
 * Get the PixiJS application instance.
 */
export function getApp(): Application | null {
  return app;
}

/**
 * Get the world container (for camera transforms).
 */
export function getWorldContainer(): Container | null {
  return worldContainer;
}

/**
 * Get render layers.
 */
export function getLayers(): RenderLayers | null {
  return layers;
}

/**
 * Get canvas dimensions.
 */
export function getCanvasSize(): { width: number; height: number } {
  if (!app) return { width: 800, height: 600 };
  return {
    width: app.screen.width,
    height: app.screen.height,
  };
}

/**
 * Get ground level Y position in screen coordinates.
 */
export function getGroundLevelY(): number {
  const { height } = getCanvasSize();
  return height * 0.5; // Ground is at center
}

/**
 * Center the camera on the seed location (ground level).
 */
export function centerCamera(): void {
  if (!worldContainer || !app) return;

  // Reset camera to origin
  cameraX = 0;
  cameraY = 0;

  updateCameraTransform();
}

/**
 * Set camera position (world coordinates).
 */
export function setCameraPosition(x: number, y: number): void {
  cameraX = x;
  cameraY = y;
  updateCameraTransform();
}

/**
 * Set camera zoom level.
 */
export function setCameraZoom(zoom: number): void {
  cameraZoom = Math.max(0.1, Math.min(5, zoom));
  updateCameraTransform();
}

/**
 * Get camera zoom level.
 */
export function getCameraZoom(): number {
  return cameraZoom;
}

/**
 * Pan camera by delta (screen pixels).
 */
export function panCamera(dx: number, dy: number): void {
  cameraX -= dx / cameraZoom;
  cameraY -= dy / cameraZoom;
  updateCameraTransform();
}

/**
 * Update world container transform based on camera state.
 */
function updateCameraTransform(): void {
  if (!worldContainer || !app) return;

  const { width, height } = getCanvasSize();
  const groundY = height * 0.5;

  // Position world container so that:
  // - Origin (0,0) in world space is at screen center horizontally
  // - Origin (0,0) in world space is at groundY vertically
  worldContainer.x = width / 2 - cameraX * cameraZoom;
  worldContainer.y = groundY - cameraY * cameraZoom;
  worldContainer.scale.set(cameraZoom);
}

/**
 * Convert screen coordinates to world coordinates (in meters).
 */
export function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
  if (!worldContainer) return { x: 0, y: 0 };

  const { width, height } = getCanvasSize();
  const groundY = height * 0.5;

  // Convert to world pixels first
  const worldPixelX = (screenX - width / 2) / cameraZoom + cameraX;
  const worldPixelY = (screenY - groundY) / cameraZoom + cameraY;

  // Convert pixels to meters
  const worldX = worldPixelX / CONFIG.PIXELS_PER_METER;
  const worldY = worldPixelY / CONFIG.PIXELS_PER_METER;

  return { x: worldX, y: worldY };
}

/**
 * Convert world coordinates (in meters) to screen coordinates.
 */
export function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
  if (!worldContainer) return { x: 0, y: 0 };

  const { width, height } = getCanvasSize();
  const groundY = height * 0.5;

  // Convert meters to world pixels
  const worldPixelX = worldX * CONFIG.PIXELS_PER_METER;
  const worldPixelY = worldY * CONFIG.PIXELS_PER_METER;

  // Apply camera transform
  const screenX = (worldPixelX - cameraX) * cameraZoom + width / 2;
  const screenY = (worldPixelY - cameraY) * cameraZoom + groundY;

  return { x: screenX, y: screenY };
}

/**
 * Destroy the renderer and clean up.
 */
export function destroyRenderer(): void {
  if (app) {
    app.destroy(true, { children: true });
    app = null;
    worldContainer = null;
    layers = null;
  }
}
