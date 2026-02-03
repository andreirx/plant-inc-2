/**
 * Main Simulation Loop.
 *
 * Fixed timestep at 20Hz (50ms per tick).
 * Calls all systems in sequence each tick.
 */

import { getState, incrementTick } from './state';
import { CONFIG } from './config';
import { updateClimateSystem } from './systems/climate';
import { updateHydraulics } from './systems/hydraulics';
import { updateMetabolism } from './systems/metabolism';
import { updateAutoGrow } from './systems/autogrow';

const TICK_INTERVAL = 1000 / CONFIG.TICKS_PER_SECOND;

let lastTickTime = 0;
let accumulator = 0;
let isRunning = false;
let animationFrameId: number | null = null;

/**
 * Start the simulation loop.
 */
export function startSimulation(): void {
  if (isRunning) return;
  isRunning = true;
  lastTickTime = performance.now();
  accumulator = 0;
  loop();
}

/**
 * Stop the simulation loop.
 */
export function stopSimulation(): void {
  isRunning = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Check if simulation is running.
 */
export function isSimulationRunning(): boolean {
  return isRunning;
}

/**
 * The main loop - uses requestAnimationFrame for smooth updates.
 */
function loop(): void {
  if (!isRunning) return;

  const currentTime = performance.now();
  const deltaTime = currentTime - lastTickTime;
  lastTickTime = currentTime;

  const state = getState();

  if (!state.isPaused) {
    // Apply speed multiplier
    accumulator += deltaTime * state.speedMultiplier;

    // Fixed timestep updates
    while (accumulator >= TICK_INTERVAL) {
      tick();
      accumulator -= TICK_INTERVAL;
    }
  }

  animationFrameId = requestAnimationFrame(loop);
}

/**
 * Single simulation tick - updates all systems.
 */
function tick(): void {
  // Order matters here!
  // 1. Climate affects everything
  updateClimateSystem();

  // 2. Hydraulics moves resources
  updateHydraulics();

  // 3. Metabolism produces/consumes resources
  updateMetabolism();

  // 4. Auto-grow (if enabled)
  updateAutoGrow();

  // 5. Increment tick counter
  incrementTick();
}

/**
 * Perform a single tick manually (for debugging/stepping).
 */
export function stepSimulation(): void {
  tick();
}
