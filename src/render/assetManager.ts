/**
 * Asset Manager - Autotile texture loading.
 *
 * Loads autotile assets for tree cross-section rendering.
 * Uses marching squares approach with 16 path variants.
 */

import { Texture, Assets } from 'pixi.js';

// Tree path tiles use NSEW naming: tree_XXXX.png
// where X is 1 if connected, 0 if not (N=bit3, S=bit2, E=bit1, W=bit0)
const TREE_TILES = Array.from({ length: 16 }, (_, i) => {
  const n = (i & 8) ? '1' : '0';
  const s = (i & 4) ? '1' : '0';
  const e = (i & 2) ? '1' : '0';
  const w = (i & 1) ? '1' : '0';
  return `tree_${n}${s}${e}${w}`;
});

const OTHER_TILES = [
  'seed',
  'leaf',
  'drop_water',
  'drop_sugar',
  'soil_surface',
  'soil_deep',
];

const ALL_ASSETS = [...TREE_TILES, ...OTHER_TILES];

export type TreeTileName = typeof TREE_TILES[number];
export type AssetName = typeof ALL_ASSETS[number];

const textureCache: Map<string, Texture> = new Map();

/**
 * Load all assets using PixiJS Assets API.
 */
export async function loadAssets(): Promise<void> {
  // Build asset bundle
  const bundle: Record<string, string> = {};
  for (const name of ALL_ASSETS) {
    bundle[name] = `/assets/tiles/${name}.png`;
  }

  // Register and load
  Assets.addBundle('tiles', bundle);

  try {
    const textures = await Assets.loadBundle('tiles');

    for (const name of ALL_ASSETS) {
      if (textures[name]) {
        textureCache.set(name, textures[name]);
      }
    }
    console.log(`Loaded ${textureCache.size} tile assets`);
  } catch (error) {
    console.warn('Failed to load assets:', error);

    // Try individual loading
    for (const name of ALL_ASSETS) {
      try {
        const texture = await Assets.load(`/assets/tiles/${name}.png`);
        textureCache.set(name, texture);
      } catch {
        console.warn(`Missing: ${name}`);
      }
    }
  }
}

/**
 * Get a texture by name.
 */
export function getTexture(name: AssetName): Texture {
  const texture = textureCache.get(name);
  if (!texture) {
    console.warn(`Texture not found: ${name}`);
    return Texture.EMPTY;
  }
  return texture;
}

/**
 * Get tree tile texture based on NSEW connectivity.
 * @param n - Connected to north
 * @param s - Connected to south
 * @param e - Connected to east
 * @param w - Connected to west
 */
export function getTreeTile(n: boolean, s: boolean, e: boolean, w: boolean): Texture {
  const name = `tree_${n ? '1' : '0'}${s ? '1' : '0'}${e ? '1' : '0'}${w ? '1' : '0'}`;
  return getTexture(name as AssetName);
}

/**
 * Get connectivity bitmask from NSEW booleans.
 */
export function getConnectivityMask(n: boolean, s: boolean, e: boolean, w: boolean): number {
  return (n ? 8 : 0) | (s ? 4 : 0) | (e ? 2 : 0) | (w ? 1 : 0);
}
