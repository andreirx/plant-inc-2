/**
 * Climate System - Updates global climate state each tick.
 *
 * Simplified from the old version but with enhanced sun position calculation.
 * - Sun position: Calculated via azimuth (x) and elevation (y)
 * - Sun intensity: Based on elevation and cloud cover
 * - Temperature: Sinusoidal day cycle
 * - Precipitation: Episodic rain events
 */

import { getState, updateClimate } from '../state';
import { CONFIG } from '../config';

const TWO_PI = Math.PI * 2;

/**
 * Call once per simulation tick to advance the climate.
 * Updates state.climate in place.
 */
export function updateClimateSystem(): void {
  const state = getState();
  const { climate } = state;

  const ticksPerDay = CONFIG.TICKS_PER_SECOND * CONFIG.SECONDS_PER_DAY;
  const dayProgress = (climate.tick % ticksPerDay) / ticksPerDay;

  // Check for new day (dayProgress wrapped around)
  const previousDayProgress = climate.dayProgress;
  const isNewDay = dayProgress < previousDayProgress && previousDayProgress > 0.9;
  const day = isNewDay ? climate.day + 1 : climate.day;

  // === Sun Position ===
  // Sun angle: 0 at dawn, PI/2 at noon, PI at dusk
  // We extend to full cycle: 0-PI for day, PI-2PI for night
  const sunAngle = dayProgress * TWO_PI;

  // Sun intensity based on elevation (sin of angle during day half)
  // Peaks at noon (dayProgress = 0.5)
  let sunIntensity: number;
  if (dayProgress < 0.25) {
    // Early morning - sun rising
    sunIntensity = Math.sin(dayProgress * TWO_PI) * 0.8;
  } else if (dayProgress < 0.75) {
    // Day time
    sunIntensity = Math.sin(dayProgress * Math.PI);
  } else {
    // Evening/night
    sunIntensity = Math.max(0, Math.sin(dayProgress * TWO_PI) * 0.3);
  }

  sunIntensity = Math.max(CONFIG.MIN_SUN_INTENSITY, sunIntensity);

  // === Temperature ===
  // Follows sun with a lag (peaks in afternoon)
  const tempPhase = (dayProgress + 0.1) * TWO_PI; // Slight lag
  const temperature =
    CONFIG.BASE_TEMPERATURE +
    CONFIG.TEMPERATURE_AMPLITUDE * Math.sin(tempPhase - Math.PI / 2);

  // === Humidity ===
  // Higher in morning and evening, lower at midday
  const humidity = 0.5 + 0.3 * Math.cos(dayProgress * TWO_PI);

  // === Precipitation ===
  let isRaining = climate.isRaining;
  let soilWater = climate.soilWater;

  // Stochastic rain events
  if (!isRaining) {
    // Chance to start rain (higher when humidity is high)
    const rainChance = CONFIG.RAIN_START_CHANCE * (1 + humidity);
    if (Math.random() < rainChance) {
      isRaining = true;
    }
  } else {
    // Chance to stop rain
    if (Math.random() < CONFIG.RAIN_STOP_CHANCE) {
      isRaining = false;
    }
  }

  // Soil water dynamics
  if (isRaining) {
    soilWater = Math.min(1.0, soilWater + CONFIG.RAIN_WATER_RATE);
  } else {
    // Evaporation (faster when sunny and warm)
    const evapFactor = sunIntensity * (temperature / 30);
    soilWater = Math.max(0, soilWater - CONFIG.EVAPORATION_RATE * evapFactor);
  }

  // Update climate state
  updateClimate({
    sunIntensity,
    sunAngle,
    temperature,
    humidity,
    soilWater,
    isRaining,
    dayProgress,
    day,
  });
}

/**
 * Get sun position in screen coordinates for rendering.
 * Returns { x, y } where x is horizontal position (-1 to 1) and y is height (0 to 1).
 */
export function getSunScreenPosition(): { x: number; y: number } {
  const state = getState();
  const { sunAngle } = state.climate;

  // X position: -1 (east) to 1 (west)
  const x = Math.cos(sunAngle - Math.PI / 2);

  // Y position: 0 (horizon) to 1 (zenith), negative = below horizon
  const y = Math.sin(sunAngle - Math.PI / 2);

  return { x, y: Math.max(0, y) };
}

/**
 * Get sky color based on time of day.
 * Interpolates between day and night colors.
 */
export function getSkyColor(): number {
  const state = getState();
  const { sunIntensity } = state.climate;

  // Lerp between night and day colors
  const t = sunIntensity;

  const dayR = (CONFIG.COLOR_SKY_DAY >> 16) & 0xff;
  const dayG = (CONFIG.COLOR_SKY_DAY >> 8) & 0xff;
  const dayB = CONFIG.COLOR_SKY_DAY & 0xff;

  const nightR = (CONFIG.COLOR_SKY_NIGHT >> 16) & 0xff;
  const nightG = (CONFIG.COLOR_SKY_NIGHT >> 8) & 0xff;
  const nightB = CONFIG.COLOR_SKY_NIGHT & 0xff;

  const r = Math.round(nightR + (dayR - nightR) * t);
  const g = Math.round(nightG + (dayG - nightG) * t);
  const b = Math.round(nightB + (dayB - nightB) * t);

  return (r << 16) | (g << 8) | b;
}

/**
 * Check if it's currently night time.
 */
export function isNightTime(): boolean {
  const state = getState();
  return state.climate.sunIntensity < 0.1;
}

/**
 * Get water availability at a specific soil depth.
 * Deeper soil retains more water.
 */
export function getSoilWaterAtDepth(depth: number): number {
  const state = getState();
  const baseWater = state.climate.soilWater;

  // Deeper soil has more stable water content
  const depthFactor = Math.min(1, depth / 2); // Normalize to ~2 meters
  const depthBonus = depthFactor * 0.3; // Up to 30% bonus at depth

  return Math.min(1.0, baseWater + depthBonus);
}
