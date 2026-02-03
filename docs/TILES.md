# Tile System Design

## Concept

The tree is rendered as a **cross-section view** showing internal structure:
- **Bark**: The outer skin/boundary of the tree
- **Vessels**: The internal "pipes" (Xylem for water UP, Phloem for sugar DOWN)
- **Particles**: Animated sprites flowing through the vessels

```
A vertical trunk segment (3 tiles wide):

    ┌─────────────┬─────────────┬─────────────┐
    │ BARK_LEFT   │  VESSEL_V   │ BARK_RIGHT  │
    │ ░░░░░│██████│██████│░░░░░ │
    │ ░░░░░│▓▓▓▓▓▓│▓▓▓▓▓▓│░░░░░ │ <- xylem (blue) + phloem (gold)
    │ ░░░░░│██████│██████│░░░░░ │
    └─────────────┴─────────────┴─────────────┘

A horizontal branch segment:

    ┌─────────────┐
    │ BARK_TOP    │
    │═════════════│
    ├─────────────┤
    │ VESSEL_H    │  <- xylem + phloem running horizontally
    ├─────────────┤
    │ BARK_BOTTOM │
    │═════════════│
    └─────────────┘
```

## Tile Categories

### 1. BARK TILES (Boundary)
The "skin" of the tree. Shows wood grain texture on outside, smooth on inside.

| Tile | Description |
|------|-------------|
| `bark_v_left` | Vertical bark, tree interior on RIGHT |
| `bark_v_right` | Vertical bark, tree interior on LEFT |
| `bark_h_top` | Horizontal bark, tree interior BELOW |
| `bark_h_bottom` | Horizontal bark, tree interior ABOVE |

### 2. BARK CORNER TILES (Direction Changes)
Where bark changes from vertical to horizontal.

**Outer corners (convex, outside of tree):**
| Tile | Description |
|------|-------------|
| `bark_corner_nw` | Top-left outer corner (bark wraps around) |
| `bark_corner_ne` | Top-right outer corner |
| `bark_corner_sw` | Bottom-left outer corner |
| `bark_corner_se` | Bottom-right outer corner |

**Inner corners (concave, inside of tree - where branches fork):**
| Tile | Description |
|------|-------------|
| `bark_inner_nw` | Top-left inner corner |
| `bark_inner_ne` | Top-right inner corner |
| `bark_inner_sw` | Bottom-left inner corner |
| `bark_inner_se` | Bottom-right inner corner |

### 3. VESSEL TILES (Internal Plumbing)
The capillary system. Each tile shows BOTH:
- **Xylem** (outer, blue): Water/minerals moving UP
- **Phloem** (inner, gold): Sugars moving DOWN

| Tile | Description |
|------|-------------|
| `vessel_vertical` | Vertical vessels (main trunk/branches) |
| `vessel_horizontal` | Horizontal vessels (side branches) |
| `vessel_cross` | 4-way junction |
| `vessel_corner_nw` | Vessels turn from down→right |
| `vessel_corner_ne` | Vessels turn from down→left |
| `vessel_corner_sw` | Vessels turn from up→right |
| `vessel_corner_se` | Vessels turn from up→left |
| `vessel_t_up` | T-junction opening upward |
| `vessel_t_down` | T-junction opening downward |
| `vessel_t_left` | T-junction opening leftward |
| `vessel_t_right` | T-junction opening rightward |

### 4. END/TIP TILES
Where branches/roots terminate.

| Tile | Description |
|------|-------------|
| `tip_up` | Top of branch (rounded bark + vessel ends) |
| `tip_down` | Root tip (pointed, with root cap) |
| `tip_left` | End of leftward branch |
| `tip_right` | End of rightward branch |

### 5. SPECIAL TILES

| Tile | Description |
|------|-------------|
| `seed` | Starting seed at ground level |
| `leaf_attach` | Where leaf connects (photosynthesis input) |
| `root_zone` | Root absorption zone (water input) |

### 6. PARTICLE SPRITES (Not tiles, but sprites)

| Sprite | Size | Description |
|--------|------|-------------|
| `drop_water` | 8x8 | Blue water droplet moving UP through xylem |
| `drop_sugar` | 8x8 | Gold sugar granule moving DOWN through phloem |

## Tile Assembly Example

A simple Y-fork (trunk splits into two branches):

```
Row 0:  [bark_corner_nw][vessel_corner_nw][bark_inner_se]   [bark_inner_sw][vessel_corner_ne][bark_corner_ne]
Row 1:  [bark_v_left]   [vessel_vertical] [bark_v_right]    [bark_v_left]  [vessel_vertical] [bark_v_right]
Row 2:  [bark_inner_ne] [vessel_t_up]     [bark_inner_nw]
Row 3:  [bark_v_left]   [vessel_vertical] [bark_v_right]
Row 4:  [bark_v_left]   [vessel_vertical] [bark_v_right]
```

## Visual Style

- **Bark**: Woody brown with visible grain/texture, darker on exterior
- **Xylem**: Pale blue tubes/channels, can see "empty" space for water
- **Phloem**: Golden/amber tubes, slightly translucent
- **Particles**: Glowing dots with motion blur trailing effect
