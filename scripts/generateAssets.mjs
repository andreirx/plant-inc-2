/**
 * Asset Generator for Sap & Sun
 *
 * Generates AUTOTILE path variants for the tree cross-section.
 * Uses marching squares approach - 16 variants based on NSEW connectivity.
 *
 * Each tile shows:
 * - BARK boundary on edges that DON'T connect to neighbors
 * - VESSEL channels (xylem outer, phloem inner) leading to connected edges
 */

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '..', 'public', 'assets', 'tiles');

const TILE_SIZE = 64;
const HALF = TILE_SIZE / 2;

// Ensure output directory exists
if (!existsSync(ASSETS_DIR)) {
  mkdirSync(ASSETS_DIR, { recursive: true });
}

// Color palette
const COLORS = {
  // Bark (outer boundary)
  bark: '#5d3a1a',
  barkDark: '#3d2510',
  barkLight: '#7a5230',

  // Pith (background inside tree)
  pith: '#c4b090',

  // Xylem (water transport - blue, OUTER channels)
  xylem: '#4a90b8',
  xylemDark: '#2d5a7a',
  xylemLight: '#7ac0e0',

  // Phloem (sugar transport - gold, CENTER channel)
  phloem: '#c4a040',
  phloemDark: '#8a6a20',
  phloemLight: '#e8c860',

  // Particles
  waterBlue: '#4fc3f7',
  sugarGold: '#ffd54f',

  // Soil
  soilSurface: '#4a3728',
  soilDeep: '#3d2b1f',

  // Leaf
  leafGreen: '#4caf50',
  leafDark: '#2e7d32',
};

// Connectivity bitmask
const N = 8, S = 4, E = 2, W = 1;

// Helper to save canvas as PNG
function saveCanvas(canvas, filename) {
  const buffer = canvas.toBuffer('image/png');
  const filepath = join(ASSETS_DIR, filename);
  writeFileSync(filepath, buffer);
  console.log(`  Created: ${filename}`);
}

// Seeded random for consistent textures
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Draw bark texture in a region
 */
function drawBark(ctx, x, y, w, h, seed = 42) {
  const rng = mulberry32(seed);

  // Base bark color
  ctx.fillStyle = COLORS.bark;
  ctx.fillRect(x, y, w, h);

  // Grain lines
  ctx.strokeStyle = COLORS.barkDark;
  ctx.lineWidth = 1;

  const isVertical = h > w;
  if (isVertical) {
    for (let i = 0; i < 4; i++) {
      const gx = x + 2 + rng() * (w - 4);
      ctx.globalAlpha = 0.3 + rng() * 0.3;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + (rng() - 0.5) * 3, y + h);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const gy = y + 2 + rng() * (h - 4);
      ctx.globalAlpha = 0.3 + rng() * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy + (rng() - 0.5) * 3);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Draw vessel channels from center toward an edge
 */
function drawVesselToEdge(ctx, direction, seed = 100) {
  const rng = mulberry32(seed);
  const barkWidth = 10;
  const xylemWidth = 8;
  const phloemWidth = 6;
  const gap = 2;

  // Channel dimensions
  const innerStart = barkWidth;
  const innerEnd = TILE_SIZE - barkWidth;
  const innerSize = innerEnd - innerStart;

  ctx.save();

  if (direction === 'N') {
    // Xylem channels (outer, blue) going to north edge
    ctx.fillStyle = COLORS.xylem;
    ctx.fillRect(HALF - xylemWidth - gap, 0, xylemWidth, HALF);
    ctx.fillRect(HALF + gap, 0, xylemWidth, HALF);

    // Phloem channel (center, gold) going to north edge
    ctx.fillStyle = COLORS.phloem;
    ctx.fillRect(HALF - phloemWidth/2, 0, phloemWidth, HALF);

    // Highlight
    ctx.fillStyle = COLORS.xylemLight;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(HALF - xylemWidth - gap, 0, 2, HALF);
    ctx.fillRect(HALF + gap, 0, 2, HALF);
  }
  else if (direction === 'S') {
    ctx.fillStyle = COLORS.xylem;
    ctx.fillRect(HALF - xylemWidth - gap, HALF, xylemWidth, HALF);
    ctx.fillRect(HALF + gap, HALF, xylemWidth, HALF);

    ctx.fillStyle = COLORS.phloem;
    ctx.fillRect(HALF - phloemWidth/2, HALF, phloemWidth, HALF);

    ctx.fillStyle = COLORS.xylemLight;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(HALF - xylemWidth - gap, HALF, 2, HALF);
    ctx.fillRect(HALF + gap, HALF, 2, HALF);
  }
  else if (direction === 'E') {
    ctx.fillStyle = COLORS.xylem;
    ctx.fillRect(HALF, HALF - xylemWidth - gap, HALF, xylemWidth);
    ctx.fillRect(HALF, HALF + gap, HALF, xylemWidth);

    ctx.fillStyle = COLORS.phloem;
    ctx.fillRect(HALF, HALF - phloemWidth/2, HALF, phloemWidth);

    ctx.fillStyle = COLORS.xylemLight;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(HALF, HALF - xylemWidth - gap, HALF, 2);
    ctx.fillRect(HALF, HALF + gap, HALF, 2);
  }
  else if (direction === 'W') {
    ctx.fillStyle = COLORS.xylem;
    ctx.fillRect(0, HALF - xylemWidth - gap, HALF, xylemWidth);
    ctx.fillRect(0, HALF + gap, HALF, xylemWidth);

    ctx.fillStyle = COLORS.phloem;
    ctx.fillRect(0, HALF - phloemWidth/2, HALF, phloemWidth);

    ctx.fillStyle = COLORS.xylemLight;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, HALF - xylemWidth - gap, HALF, 2);
    ctx.fillRect(0, HALF + gap, HALF, 2);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Draw the center junction where channels meet
 */
function drawCenterJunction(ctx, conn) {
  const junctionRadius = 12;
  const xylemWidth = 8;
  const phloemWidth = 6;

  // Xylem outer ring
  ctx.fillStyle = COLORS.xylem;
  ctx.beginPath();
  ctx.arc(HALF, HALF, junctionRadius, 0, Math.PI * 2);
  ctx.fill();

  // Xylem highlight
  ctx.fillStyle = COLORS.xylemLight;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(HALF - 3, HALF - 3, junctionRadius - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Phloem center
  ctx.fillStyle = COLORS.phloem;
  ctx.beginPath();
  ctx.arc(HALF, HALF, phloemWidth, 0, Math.PI * 2);
  ctx.fill();

  // Phloem highlight
  ctx.fillStyle = COLORS.phloemLight;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(HALF - 2, HALF - 2, phloemWidth - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Generate a single path tile variant
 * @param {number} conn - Connectivity bitmask (N=8, S=4, E=2, W=1)
 */
function generatePathTile(conn) {
  const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext('2d');

  const hasN = conn & N;
  const hasS = conn & S;
  const hasE = conn & E;
  const hasW = conn & W;
  const barkWidth = 10;

  // Clear with pith background
  ctx.fillStyle = COLORS.pith;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Draw vessel channels for each connected direction
  if (hasN) drawVesselToEdge(ctx, 'N', 100 + conn);
  if (hasS) drawVesselToEdge(ctx, 'S', 200 + conn);
  if (hasE) drawVesselToEdge(ctx, 'E', 300 + conn);
  if (hasW) drawVesselToEdge(ctx, 'W', 400 + conn);

  // Draw center junction if any connections
  if (conn > 0) {
    drawCenterJunction(ctx, conn);
  }

  // Draw bark on edges that DON'T connect
  if (!hasN) drawBark(ctx, 0, 0, TILE_SIZE, barkWidth, 10 + conn);
  if (!hasS) drawBark(ctx, 0, TILE_SIZE - barkWidth, TILE_SIZE, barkWidth, 20 + conn);
  if (!hasE) drawBark(ctx, TILE_SIZE - barkWidth, 0, barkWidth, TILE_SIZE, 30 + conn);
  if (!hasW) drawBark(ctx, 0, 0, barkWidth, TILE_SIZE, 40 + conn);

  // Draw corner bark fills for non-connected corners
  if (!hasN && !hasW) {
    ctx.fillStyle = COLORS.bark;
    ctx.fillRect(0, 0, barkWidth, barkWidth);
  }
  if (!hasN && !hasE) {
    ctx.fillStyle = COLORS.bark;
    ctx.fillRect(TILE_SIZE - barkWidth, 0, barkWidth, barkWidth);
  }
  if (!hasS && !hasW) {
    ctx.fillStyle = COLORS.bark;
    ctx.fillRect(0, TILE_SIZE - barkWidth, barkWidth, barkWidth);
  }
  if (!hasS && !hasE) {
    ctx.fillStyle = COLORS.bark;
    ctx.fillRect(TILE_SIZE - barkWidth, TILE_SIZE - barkWidth, barkWidth, barkWidth);
  }

  // Format: tree_XXXX where X is 1 if connected, 0 if not (NSEW order)
  const n = hasN ? '1' : '0';
  const s = hasS ? '1' : '0';
  const e = hasE ? '1' : '0';
  const w = hasW ? '1' : '0';
  const filename = `tree_${n}${s}${e}${w}.png`;

  saveCanvas(canvas, filename);
}

/**
 * Generate seed tile (special - starting point)
 */
function generateSeedTile() {
  const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext('2d');

  // Clear
  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Seed body
  const cx = HALF, cy = HALF;
  ctx.fillStyle = '#8b6914';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 24, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outline
  ctx.strokeStyle = '#5d3a1a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Highlight
  ctx.fillStyle = '#c4a35a';
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(cx - 6, cy - 4, 8, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  saveCanvas(canvas, 'seed.png');
}

/**
 * Generate leaf tile
 */
function generateLeafTile() {
  const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

  const cx = HALF, cy = HALF;

  // Leaf shape
  ctx.fillStyle = COLORS.leafGreen;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 26, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Center vein
  ctx.strokeStyle = COLORS.leafDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.stroke();

  // Side veins
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const x = cx + i * 8;
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(x + (i > 0 ? 4 : -4), cy + (i % 2 ? -6 : 6));
    ctx.stroke();
  }

  saveCanvas(canvas, 'leaf.png');
}

/**
 * Generate water droplet particle
 */
function generateWaterDrop() {
  const canvas = createCanvas(16, 16);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 16, 16);

  // Glow
  ctx.fillStyle = COLORS.waterBlue;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(8, 8, 7, 0, Math.PI * 2);
  ctx.fill();

  // Core
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(8, 8, 5, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(6, 6, 2, 0, Math.PI * 2);
  ctx.fill();

  saveCanvas(canvas, 'drop_water.png');
}

/**
 * Generate sugar granule particle
 */
function generateSugarDrop() {
  const canvas = createCanvas(16, 16);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 16, 16);

  // Glow
  ctx.fillStyle = COLORS.sugarGold;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(8, 8, 7, 0, Math.PI * 2);
  ctx.fill();

  // Core
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(8, 8, 5, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(6, 6, 2, 0, Math.PI * 2);
  ctx.fill();

  saveCanvas(canvas, 'drop_sugar.png');
}

/**
 * Generate soil tiles
 */
function generateSoilTiles() {
  // Surface soil
  let canvas = createCanvas(TILE_SIZE, TILE_SIZE);
  let ctx = canvas.getContext('2d');
  const rng1 = mulberry32(42);

  ctx.fillStyle = COLORS.soilSurface;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Texture
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = rng1() > 0.5 ? '#5a4030' : '#3d2b1f';
    ctx.globalAlpha = 0.3 + rng1() * 0.3;
    ctx.beginPath();
    ctx.arc(rng1() * TILE_SIZE, rng1() * TILE_SIZE, 1 + rng1() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Grass tufts on top
  ctx.strokeStyle = '#3d5c3d';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const x = 5 + rng1() * (TILE_SIZE - 10);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rng1() - 0.5) * 4, -4 - rng1() * 8);
    ctx.stroke();
  }

  saveCanvas(canvas, 'soil_surface.png');

  // Deep soil
  canvas = createCanvas(TILE_SIZE, TILE_SIZE);
  ctx = canvas.getContext('2d');
  const rng2 = mulberry32(123);

  ctx.fillStyle = COLORS.soilDeep;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  for (let i = 0; i < 15; i++) {
    ctx.fillStyle = rng2() > 0.5 ? '#4a3728' : '#2d1f15';
    ctx.globalAlpha = 0.2 + rng2() * 0.3;
    ctx.beginPath();
    ctx.arc(rng2() * TILE_SIZE, rng2() * TILE_SIZE, 1 + rng2() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  saveCanvas(canvas, 'soil_deep.png');
}

// ============================================================
// MAIN GENERATION
// ============================================================

console.log('Generating Sap & Sun tile assets (autotile system)...\n');
console.log(`Output directory: ${ASSETS_DIR}\n`);
console.log(`Tile size: ${TILE_SIZE}x${TILE_SIZE} pixels\n`);

console.log('═══════════════════════════════════════');
console.log('TREE PATH TILES (16 variants)');
console.log('───────────────────────────────────────');

// Generate all 16 path variants
for (let conn = 0; conn < 16; conn++) {
  generatePathTile(conn);
}

console.log('\n═══════════════════════════════════════');
console.log('SPECIAL TILES');
console.log('───────────────────────────────────────');
generateSeedTile();
generateLeafTile();

console.log('\n═══════════════════════════════════════');
console.log('PARTICLE SPRITES');
console.log('───────────────────────────────────────');
generateWaterDrop();
generateSugarDrop();

console.log('\n═══════════════════════════════════════');
console.log('SOIL TILES');
console.log('───────────────────────────────────────');
generateSoilTiles();

console.log('\n═══════════════════════════════════════');
console.log('COMPLETE!');
console.log('═══════════════════════════════════════');
console.log(`
Generated autotile system:
- 16 tree path variants (tree_NSEW.png where N/S/E/W = 0 or 1)
- 2 special tiles (seed, leaf)
- 2 particle sprites
- 2 soil tiles

Total: 22 assets
`);
