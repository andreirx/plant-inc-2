/**
 * Flow Particles Layer - Visualizes the "Seva" (sap flow).
 *
 * Blue particles (Xylem): Water moving UP from roots to leaves
 * Gold particles (Phloem): Sugar moving DOWN from leaves to roots
 *
 * Particles interpolate between connected nodes based on their progress.
 * Speed reflects the pressure/concentration differential.
 */

import { Container, Graphics, Sprite, RenderTexture } from 'pixi.js';
import { getApp } from '../app';
import { getState } from '@core/state';
import { CONFIG } from '@core/config';
import { getParticles, FlowParticle } from '@core/systems/hydraulics';
import { lerp } from '@utils/vector';

let particleContainer: Container | null = null;
let particleSprites: Map<string, Sprite> = new Map();
let xylemTexture: RenderTexture | null = null;
let phloemTexture: RenderTexture | null = null;

/**
 * Initialize the flow particles layer.
 */
export function initFlowParticlesLayer(container: Container): void {
  particleContainer = new Container();
  container.addChild(particleContainer);

  // Create particle textures
  createParticleTextures();

  // Initial draw
  updateFlowParticlesLayer();
}

/**
 * Create the particle textures (glowing dots).
 */
function createParticleTextures(): void {
  const app = getApp();
  if (!app) return;

  const size = 16;

  // Xylem (water) - blue glow
  const xylemGfx = new Graphics();
  xylemGfx.circle(size / 2, size / 2, size * 0.25);
  xylemGfx.fill({ color: CONFIG.COLOR_XYLEM, alpha: 1 });
  xylemGfx.circle(size / 2, size / 2, size * 0.4);
  xylemGfx.fill({ color: CONFIG.COLOR_XYLEM, alpha: 0.4 });

  xylemTexture = RenderTexture.create({ width: size, height: size });
  app.renderer.render({ container: xylemGfx, target: xylemTexture });
  xylemGfx.destroy();

  // Phloem (sugar) - gold glow
  const phloemGfx = new Graphics();
  phloemGfx.circle(size / 2, size / 2, size * 0.25);
  phloemGfx.fill({ color: CONFIG.COLOR_PHLOEM, alpha: 1 });
  phloemGfx.circle(size / 2, size / 2, size * 0.4);
  phloemGfx.fill({ color: CONFIG.COLOR_PHLOEM, alpha: 0.4 });

  phloemTexture = RenderTexture.create({ width: size, height: size });
  app.renderer.render({ container: phloemGfx, target: phloemTexture });
  phloemGfx.destroy();
}

/**
 * Update the flow particles layer each frame.
 */
export function updateFlowParticlesLayer(): void {
  if (!particleContainer) return;

  const state = getState();
  const particles = getParticles();

  // Track which particles we've seen this frame
  const seenParticleIds = new Set<string>();

  for (const particle of particles) {
    seenParticleIds.add(particle.id);

    // Get or create sprite
    let sprite = particleSprites.get(particle.id);
    if (!sprite) {
      sprite = createParticleSprite(particle);
      particleSprites.set(particle.id, sprite);
      particleContainer.addChild(sprite);
    }

    // Update position
    updateParticleSprite(state, sprite, particle);
  }

  // Remove sprites for deleted particles
  for (const [particleId, sprite] of particleSprites) {
    if (!seenParticleIds.has(particleId)) {
      particleContainer.removeChild(sprite);
      sprite.destroy();
      particleSprites.delete(particleId);
    }
  }
}

/**
 * Create a sprite for a flow particle.
 */
function createParticleSprite(particle: FlowParticle): Sprite {
  const texture = particle.type === 'xylem' ? xylemTexture : phloemTexture;
  const sprite = new Sprite(texture ?? undefined);
  sprite.anchor.set(0.5);
  sprite.blendMode = 'add'; // Additive blending for glow effect
  return sprite;
}

/**
 * Update a particle sprite's position based on flow progress.
 * Xylem particles flow in the outer (blue) channels.
 * Phloem particles flow in the center (gold) channel.
 */
function updateParticleSprite(
  state: ReturnType<typeof getState>,
  sprite: Sprite,
  particle: FlowParticle
): void {
  const fromNode = state.nodes[particle.fromNodeId];
  const toNode = state.nodes[particle.toNodeId];

  if (!fromNode || !toNode) {
    sprite.visible = false;
    return;
  }

  sprite.visible = true;

  // Interpolate position along center line
  const fromPos = {
    x: fromNode.position.x * CONFIG.PIXELS_PER_METER,
    y: fromNode.position.y * CONFIG.PIXELS_PER_METER,
  };
  const toPos = {
    x: toNode.position.x * CONFIG.PIXELS_PER_METER,
    y: toNode.position.y * CONFIG.PIXELS_PER_METER,
  };

  const pos = lerp(fromPos, toPos, particle.progress);

  // Calculate perpendicular offset for xylem (outer channels)
  if (particle.type === 'xylem') {
    // Direction of flow
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // Perpendicular direction (normalized)
    const perpX = -dy / len;
    const perpY = dx / len;

    // Offset to outer channel (alternate sides based on particle id)
    const side = (parseInt(particle.id.split('_')[1]) % 2) * 2 - 1; // -1 or 1
    const offset = CONFIG.TILE_SIZE * 0.25; // Quarter tile offset

    pos.x += perpX * offset * side;
    pos.y += perpY * offset * side;
  }
  // Phloem stays in center (no offset)

  sprite.x = pos.x;
  sprite.y = pos.y;

  // Scale based on speed
  const scale = 0.8 + particle.speed * 0.2;
  sprite.scale.set(scale);

  // Alpha fades at start and end
  const fadeIn = Math.min(1, particle.progress * 5);
  const fadeOut = Math.min(1, (1 - particle.progress) * 5);
  sprite.alpha = Math.min(fadeIn, fadeOut) * 0.9;
}

/**
 * Get particle count by type (for HUD).
 */
export function getParticleCounts(): { xylem: number; phloem: number } {
  const particles = getParticles();
  return {
    xylem: particles.filter((p) => p.type === 'xylem').length,
    phloem: particles.filter((p) => p.type === 'phloem').length,
  };
}

/**
 * Clean up the flow particles layer.
 */
export function destroyFlowParticlesLayer(): void {
  if (particleContainer) {
    particleContainer.destroy({ children: true });
    particleContainer = null;
  }

  if (xylemTexture) {
    xylemTexture.destroy();
    xylemTexture = null;
  }

  if (phloemTexture) {
    phloemTexture.destroy();
    phloemTexture = null;
  }

  particleSprites.clear();
}
