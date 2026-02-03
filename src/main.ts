/**
 * Sap & Sun - Main Entry Point
 *
 * Initializes all systems and starts the game loop.
 *
 * Architecture:
 * - Core: Simulation logic (state, hydraulics, metabolism, climate)
 * - Render: PixiJS visualization (background, soil, tree, particles)
 * - UI: DOM interface (input, context menu, HUD)
 */

import { initRenderer, getLayers, getApp } from '@render/app';
import { loadAssets } from '@render/assetManager';
import { initBackgroundLayer, updateBackgroundLayer } from '@render/layers/background';
import { initSoilLayer, updateSoilLayer } from '@render/layers/soilLayer';
import { initTreeLayer, updateTreeLayer } from '@render/layers/treeLayer';
import { initFlowParticlesLayer, updateFlowParticlesLayer } from '@render/layers/flowParticles';
import { initGrowthHighlightsLayer } from '@render/layers/growthHighlights';
import { initInput } from '@ui/input';
import { initHUD, updateHUD } from '@ui/hud';
import { startSimulation } from '@core/loop';
import { getState, subscribe, addNode } from '@core/state';

/**
 * Main initialization function.
 */
async function init(): Promise<void> {
  console.log('Sap & Sun - Initializing...');

  // Get the app container
  const container = document.getElementById('app');
  if (!container) {
    throw new Error('App container not found');
  }

  // Initialize renderer
  console.log('Initializing renderer...');
  await initRenderer(container);

  // Load assets
  console.log('Loading assets...');
  await loadAssets();

  // Get render layers
  const layers = getLayers();
  if (!layers) {
    throw new Error('Render layers not initialized');
  }

  // Initialize render layers
  console.log('Initializing render layers...');
  initBackgroundLayer(layers.background);
  initSoilLayer(layers.soil);
  initTreeLayer(layers.tree);
  initGrowthHighlightsLayer(layers.highlights);
  initFlowParticlesLayer(layers.particles);

  // Initialize UI
  console.log('Initializing UI...');
  initInput();
  initHUD();

  // Create initial plant structure
  createInitialPlant();

  // Subscribe to state changes for render updates
  subscribe((event) => {
    // Update render on every tick
    if (event.type === 'tick') {
      updateBackgroundLayer();
      updateSoilLayer();
      updateTreeLayer();
      updateFlowParticlesLayer();
    }
  });

  // Start render loop (separate from simulation)
  const app = getApp();
  if (app) {
    app.ticker.add(() => {
      updateBackgroundLayer();
      updateSoilLayer();
      updateTreeLayer();
      updateFlowParticlesLayer();
      updateHUD();
    });
  }

  // Start simulation
  console.log('Starting simulation...');
  startSimulation();

  console.log('Sap & Sun - Ready!');
  console.log('');
  console.log('Controls:');
  console.log('  Left-click node: Show growth options');
  console.log('  Left-click highlight: Grow in that direction');
  console.log('  Left-click empty: Deselect');
  console.log('  Middle-mouse drag: Pan camera');
  console.log('  Mouse wheel: Zoom');
  console.log('');
}

/**
 * Create the initial plant structure from the seed.
 * Positions are in meters. 1 tile = 0.25 meters (64px / 256 px/m).
 */
function createInitialPlant(): void {
  const state = getState();
  const seedId = state.seedId;

  // Add initial trunk going straight up
  const trunk1 = addNode(seedId, 'TRUNK', { x: 0, y: -0.25 });
  if (trunk1) {
    const trunk2 = addNode(trunk1.id, 'TRUNK', { x: 0, y: -0.5 });
    if (trunk2) {
      // Top of trunk gets a leaf
      addNode(trunk2.id, 'LEAF', { x: 0, y: -0.75 });
    }
  }

  // Add initial root going straight down
  const root1 = addNode(seedId, 'ROOT', { x: 0, y: 0.25 });
  if (root1) {
    addNode(root1.id, 'ROOT', { x: 0, y: 0.5 });
  }
}

// Start the application
init().catch((error) => {
  console.error('Failed to initialize Sap & Sun:', error);

  // Show error message to user
  const container = document.getElementById('app');
  if (container) {
    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #ff6b6b;
        font-family: system-ui;
        text-align: center;
        padding: 20px;
      ">
        <h1>Failed to initialize</h1>
        <p>${error.message}</p>
        <p style="color: #888; font-size: 14px;">Check the console for details</p>
      </div>
    `;
  }
});
