/**
 * HUD - Heads Up Display for resource monitoring.
 *
 * Shows:
 * - Sugar (gold) - the building currency
 * - Water (blue) - hydration level
 * - Minerals (gray) - nutrients
 * - Time of day / sun status
 * - Node count and health overview
 * - Simulation controls
 */

import { getState, setPaused, setSpeedMultiplier, subscribe } from '@core/state';
import { getFlowStats } from '@core/systems/hydraulics';
import { getMetabolismStats } from '@core/systems/metabolism';
import { setCameraZoom, getCameraZoom, centerCamera } from '@render/app';

let hudElement: HTMLElement | null = null;
let statsElement: HTMLElement | null = null;
let controlsElement: HTMLElement | null = null;

/**
 * Initialize the HUD.
 */
export function initHUD(): void {
  // Create HUD container
  hudElement = document.createElement('div');
  hudElement.id = 'hud';
  hudElement.style.cssText = `
    position: fixed;
    top: 16px;
    left: 16px;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    color: #fff;
    z-index: 100;
    pointer-events: none;
  `;
  document.body.appendChild(hudElement);

  // Resource display
  statsElement = document.createElement('div');
  statsElement.style.cssText = `
    background: rgba(20, 20, 30, 0.85);
    border: 1px solid #333;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 12px;
  `;
  hudElement.appendChild(statsElement);

  // Controls
  controlsElement = document.createElement('div');
  controlsElement.style.cssText = `
    background: rgba(20, 20, 30, 0.85);
    border: 1px solid #333;
    border-radius: 8px;
    padding: 12px 16px;
    pointer-events: auto;
  `;
  hudElement.appendChild(controlsElement);

  // Add control buttons
  createControls();
  createZoomControls();

  // Subscribe to state changes
  subscribe(() => {
    updateHUD();
  });

  // Initial update
  updateHUD();
}

/**
 * Create control buttons.
 */
function createControls(): void {
  if (!controlsElement) return;

  // Pause/Play button
  const pauseBtn = document.createElement('button');
  pauseBtn.id = 'pause-btn';
  pauseBtn.textContent = '⏸ Pause';
  pauseBtn.style.cssText = getButtonStyle();
  pauseBtn.addEventListener('click', () => {
    const state = getState();
    setPaused(!state.isPaused);
    pauseBtn.textContent = state.isPaused ? '▶ Play' : '⏸ Pause';
  });
  controlsElement.appendChild(pauseBtn);

  // Speed controls
  const speedLabel = document.createElement('span');
  speedLabel.style.cssText = 'margin: 0 8px; color: #888;';
  speedLabel.textContent = 'Speed:';
  controlsElement.appendChild(speedLabel);

  const speeds = [0.5, 1, 2, 5];
  for (const speed of speeds) {
    const btn = document.createElement('button');
    btn.textContent = `${speed}x`;
    btn.style.cssText = getButtonStyle(speed === 1);
    btn.addEventListener('click', () => {
      setSpeedMultiplier(speed);
      // Update button styles
      controlsElement?.querySelectorAll('button').forEach((b, i) => {
        if (i > 0) {
          // Skip pause button
          (b as HTMLButtonElement).style.cssText = getButtonStyle(
            speeds[i - 1] === speed
          );
        }
      });
    });
    controlsElement.appendChild(btn);
  }
}

/**
 * Create zoom control buttons.
 */
function createZoomControls(): void {
  if (!hudElement) return;

  const zoomContainer = document.createElement('div');
  zoomContainer.style.cssText = `
    background: rgba(20, 20, 30, 0.85);
    border: 1px solid #333;
    border-radius: 8px;
    padding: 8px 12px;
    margin-top: 12px;
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  hudElement.appendChild(zoomContainer);

  const zoomLabel = document.createElement('span');
  zoomLabel.style.cssText = 'color: #888; font-size: 12px;';
  zoomLabel.textContent = 'Zoom:';
  zoomContainer.appendChild(zoomLabel);

  // Zoom out
  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.textContent = '−';
  zoomOutBtn.style.cssText = getButtonStyle() + 'font-size: 16px; padding: 4px 10px;';
  zoomOutBtn.addEventListener('click', () => {
    setCameraZoom(getCameraZoom() * 0.8);
  });
  zoomContainer.appendChild(zoomOutBtn);

  // Zoom display
  const zoomDisplay = document.createElement('span');
  zoomDisplay.id = 'zoom-display';
  zoomDisplay.style.cssText = 'color: #fff; font-size: 12px; min-width: 40px; text-align: center;';
  zoomDisplay.textContent = '100%';
  zoomContainer.appendChild(zoomDisplay);

  // Zoom in
  const zoomInBtn = document.createElement('button');
  zoomInBtn.textContent = '+';
  zoomInBtn.style.cssText = getButtonStyle() + 'font-size: 16px; padding: 4px 10px;';
  zoomInBtn.addEventListener('click', () => {
    setCameraZoom(getCameraZoom() * 1.25);
  });
  zoomContainer.appendChild(zoomInBtn);

  // Reset view
  const resetBtn = document.createElement('button');
  resetBtn.textContent = '⌂';
  resetBtn.title = 'Reset view';
  resetBtn.style.cssText = getButtonStyle() + 'font-size: 14px; padding: 4px 8px;';
  resetBtn.addEventListener('click', () => {
    setCameraZoom(1);
    centerCamera();
  });
  zoomContainer.appendChild(resetBtn);
}

/**
 * Get button CSS.
 */
function getButtonStyle(active: boolean = false): string {
  return `
    background: ${active ? '#4fc3f7' : '#333'};
    color: ${active ? '#000' : '#fff'};
    border: 1px solid ${active ? '#4fc3f7' : '#555'};
    border-radius: 4px;
    padding: 6px 12px;
    margin-right: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.1s;
  `;
}

/**
 * Update the HUD display.
 */
export function updateHUD(): void {
  if (!statsElement) return;

  const state = getState();
  const { resources, climate } = state;
  const flowStats = getFlowStats();
  const metaStats = getMetabolismStats();

  // Calculate node counts by type
  const nodeCount = Object.keys(state.nodes).length;
  let leafCount = 0;
  let rootCount = 0;
  let trunkCount = 0;

  for (const node of Object.values(state.nodes)) {
    if (!node.isActive) continue;
    if (node.type === 'LEAF') leafCount++;
    else if (node.type === 'ROOT') rootCount++;
    else if (node.type === 'TRUNK' || node.type === 'BRANCH') trunkCount++;
  }

  // Calculate balance warning
  const canopySize = leafCount + trunkCount;
  const balanceRatio = rootCount > 0 ? canopySize / rootCount : canopySize;
  const isUnbalanced = balanceRatio > 4; // Warning if canopy is 4x bigger than roots

  // Update zoom display
  const zoomDisplay = document.getElementById('zoom-display');
  if (zoomDisplay) {
    zoomDisplay.textContent = `${Math.round(getCameraZoom() * 100)}%`;
  }

  // Time display
  const timeOfDay = getTimeOfDayString(climate.dayProgress);
  const year = Math.floor((climate.day - 1) / 365) + 1;
  const dayOfYear = ((climate.day - 1) % 365) + 1;

  statsElement.innerHTML = `
    <div style="margin-bottom: 8px; font-weight: bold; color: #4fc3f7;">
      Sap & Sun
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
      <div>
        <span style="color: #ffd54f;">◆</span> Sugar: ${Math.round(resources.sugar)}
      </div>
      <div>
        <span style="color: #4fc3f7;">◆</span> Water: ${Math.round(resources.water)}
      </div>
      <div>
        <span style="color: #888;">◆</span> Minerals: ${Math.round(resources.minerals)}
      </div>
      <div>
        <span style="color: #ffeb3b;">☀</span> ${timeOfDay}
      </div>
    </div>

    <div style="font-size: 12px; color: #aaa; margin-bottom: 8px; text-align: center;">
      Day ${dayOfYear}, Year ${year}
    </div>

    <div style="font-size: 12px; color: #888; border-top: 1px solid #333; padding-top: 8px;">
      <div style="display: flex; justify-content: space-between;">
        <span>Nodes: ${nodeCount}</span>
        <span>Healthy: ${metaStats.healthyNodes}</span>
        <span>Stressed: ${metaStats.stressedNodes}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 4px;">
        <span style="color: #4fc3f7;">Xylem: ${flowStats.xylemParticles}</span>
        <span style="color: #ffd54f;">Phloem: ${flowStats.phloemParticles}</span>
      </div>
      <div style="margin-top: 4px;">
        Sun: ${Math.round(climate.sunIntensity * 100)}% |
        Soil Water: ${Math.round(climate.soilWater * 100)}%
        ${climate.isRaining ? ' | 🌧 Rain' : ''}
      </div>
      <div style="margin-top: 4px;">
        🌿 Leaves: ${leafCount} | 🌳 Trunk: ${trunkCount} | 🌱 Roots: ${rootCount}
      </div>
      ${isUnbalanced ? `
        <div style="margin-top: 8px; padding: 6px; background: rgba(255, 100, 100, 0.3); border-radius: 4px; color: #ff6b6b;">
          ⚠️ Canopy too large for roots! Add more roots or thicken stems.
        </div>
      ` : ''}
    </div>
  `;

  // Update pause button text
  const pauseBtn = document.getElementById('pause-btn');
  if (pauseBtn) {
    pauseBtn.textContent = state.isPaused ? '▶ Play' : '⏸ Pause';
  }
}

/**
 * Get a human-readable time of day string.
 */
function getTimeOfDayString(dayProgress: number): string {
  if (dayProgress < 0.1) return '🌅 Dawn';
  if (dayProgress < 0.25) return '🌄 Morning';
  if (dayProgress < 0.45) return '☀ Late Morning';
  if (dayProgress < 0.55) return '☀ Noon';
  if (dayProgress < 0.7) return '☀ Afternoon';
  if (dayProgress < 0.85) return '🌅 Evening';
  if (dayProgress < 0.95) return '🌙 Dusk';
  return '🌙 Night';
}

/**
 * Clean up the HUD.
 */
export function destroyHUD(): void {
  if (hudElement) {
    hudElement.remove();
    hudElement = null;
  }
  statsElement = null;
  controlsElement = null;
}
