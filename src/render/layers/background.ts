/**
 * Background Layer - Sky, Sun, and Weather.
 *
 * Renders the sky gradient based on time of day.
 * Sun sprite moves in an arc across the sky.
 * Weather overlays (rain/snow) when active.
 */

import { Container, Graphics, Sprite, RenderTexture } from 'pixi.js';
import { getApp, getCanvasSize, getGroundLevelY } from '../app';
import { getState } from '@core/state';
import { CONFIG } from '@core/config';
import { getSunScreenPosition, getSkyColor } from '@core/systems/climate';

let skyGraphics: Graphics | null = null;
let sunSprite: Sprite | null = null;
let rainContainer: Container | null = null;

interface RainDrop {
  sprite: Graphics;
  x: number;
  y: number;
  speed: number;
}

let rainDrops: RainDrop[] = [];
const MAX_RAIN_DROPS = 100;

/**
 * Initialize the background layer.
 */
export function initBackgroundLayer(container: Container): void {
  // Sky gradient
  skyGraphics = new Graphics();
  container.addChild(skyGraphics);

  // Sun
  sunSprite = createSunSprite();
  container.addChild(sunSprite);

  // Rain container
  rainContainer = new Container();
  container.addChild(rainContainer);

  // Initial draw
  updateBackgroundLayer();
}

/**
 * Create the sun sprite.
 */
function createSunSprite(): Sprite {
  const app = getApp();
  if (!app) return new Sprite();

  const gfx = new Graphics();
  const size = 60;

  // Sun glow
  gfx.circle(size / 2, size / 2, size * 0.4);
  gfx.fill({ color: CONFIG.COLOR_SUN, alpha: 0.3 });

  // Sun body
  gfx.circle(size / 2, size / 2, size * 0.25);
  gfx.fill(CONFIG.COLOR_SUN);

  // Sun rays
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x1 = size / 2 + Math.cos(angle) * size * 0.3;
    const y1 = size / 2 + Math.sin(angle) * size * 0.3;
    const x2 = size / 2 + Math.cos(angle) * size * 0.45;
    const y2 = size / 2 + Math.sin(angle) * size * 0.45;
    gfx.moveTo(x1, y1);
    gfx.lineTo(x2, y2);
    gfx.stroke({ color: CONFIG.COLOR_SUN, width: 2 });
  }

  const renderTexture = RenderTexture.create({ width: size, height: size });
  app.renderer.render({ container: gfx, target: renderTexture });
  gfx.destroy();

  const sprite = new Sprite(renderTexture);
  sprite.anchor.set(0.5);

  return sprite;
}

/**
 * Update the background layer each frame.
 */
export function updateBackgroundLayer(): void {
  const { width, height } = getCanvasSize();
  const groundY = getGroundLevelY();
  const state = getState();

  // Update sky
  if (skyGraphics) {
    skyGraphics.clear();

    const skyColor = getSkyColor();

    // Sky gradient (top half of screen)
    // Create a simple two-tone gradient
    const skyTopColor = skyColor;
    const skyBottomColor = blendColors(skyColor, 0xffffff, 0.2);

    // Top part
    skyGraphics.rect(0, -height, width, height);
    skyGraphics.fill(skyTopColor);

    // Horizon glow
    skyGraphics.rect(0, groundY - height * 0.3, width, height * 0.3);
    skyGraphics.fill({ color: skyBottomColor, alpha: 0.5 });
  }

  // Update sun position
  if (sunSprite) {
    const sunPos = getSunScreenPosition();
    const { width: w } = getCanvasSize();
    const groundLevel = getGroundLevelY();

    // Sun moves in an arc
    // x: -1 to 1 maps to 10% to 90% of screen width
    // y: 0 to 1 maps to ground level to top of screen
    sunSprite.x = w * 0.5 + sunPos.x * w * 0.4;
    sunSprite.y = groundLevel - sunPos.y * groundLevel * 0.8;

    // Fade sun at night
    sunSprite.alpha = Math.min(1, state.climate.sunIntensity * 2);
    sunSprite.visible = sunSprite.alpha > 0.1;

    // Color shift at sunrise/sunset
    const timeOfDay = state.climate.dayProgress;
    if (timeOfDay < 0.1 || timeOfDay > 0.9) {
      sunSprite.tint = 0xff6600; // Orange at sunrise/sunset
    } else {
      sunSprite.tint = 0xffffff; // Normal
    }
  }

  // Update rain
  updateRain(state.climate.isRaining);
}

/**
 * Update rain particles.
 */
function updateRain(isRaining: boolean): void {
  if (!rainContainer) return;

  const { width, height } = getCanvasSize();
  const groundY = getGroundLevelY();

  if (isRaining) {
    // Spawn new drops
    while (rainDrops.length < MAX_RAIN_DROPS) {
      const drop = new Graphics();
      drop.moveTo(0, 0);
      drop.lineTo(0, 8 + Math.random() * 8);
      drop.stroke({ color: 0x6699cc, width: 1, alpha: 0.5 });

      const rainDrop: RainDrop = {
        sprite: drop,
        x: Math.random() * width,
        y: -groundY + Math.random() * height,
        speed: 300 + Math.random() * 200,
      };

      rainDrops.push(rainDrop);
      rainContainer.addChild(drop);
    }
  }

  // Update existing drops
  const dt = 1 / 60; // Assume 60fps
  rainDrops = rainDrops.filter((drop) => {
    drop.y += drop.speed * dt;
    drop.sprite.x = drop.x;
    drop.sprite.y = drop.y;

    // Remove if below ground
    if (drop.y > groundY + 20) {
      rainContainer!.removeChild(drop.sprite);
      drop.sprite.destroy();
      return false;
    }

    return true;
  });

  // Fade out rain when stopping
  if (!isRaining) {
    rainContainer.alpha = Math.max(0, rainContainer.alpha - 0.02);
  } else {
    rainContainer.alpha = Math.min(1, rainContainer.alpha + 0.05);
  }
}

/**
 * Blend two colors.
 */
function blendColors(color1: number, color2: number, ratio: number): number {
  const r1 = (color1 >> 16) & 0xff;
  const g1 = (color1 >> 8) & 0xff;
  const b1 = color1 & 0xff;

  const r2 = (color2 >> 16) & 0xff;
  const g2 = (color2 >> 8) & 0xff;
  const b2 = color2 & 0xff;

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return (r << 16) | (g << 8) | b;
}

/**
 * Clean up the background layer.
 */
export function destroyBackgroundLayer(): void {
  if (skyGraphics) {
    skyGraphics.destroy();
    skyGraphics = null;
  }
  if (sunSprite) {
    sunSprite.destroy();
    sunSprite = null;
  }
  if (rainContainer) {
    rainContainer.destroy({ children: true });
    rainContainer = null;
  }
  rainDrops = [];
}
