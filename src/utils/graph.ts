/**
 * Graph traversal utilities for the plant node DAG.
 * Helpers to navigate parent/child relationships and find paths.
 */

import type { PlantNode, GameState } from '@core/types';

/** Get a node by ID, or null if not found */
export function getNode(state: GameState, nodeId: string): PlantNode | null {
  return state.nodes[nodeId] ?? null;
}

/** Get the parent node, or null if this is the root */
export function getParent(state: GameState, node: PlantNode): PlantNode | null {
  if (!node.parentId) return null;
  return state.nodes[node.parentId] ?? null;
}

/** Get all child nodes */
export function getChildren(state: GameState, node: PlantNode): PlantNode[] {
  return node.childrenIds
    .map((id) => state.nodes[id])
    .filter((n): n is PlantNode => n !== undefined);
}

/** Get all sibling nodes (nodes sharing the same parent) */
export function getSiblings(state: GameState, node: PlantNode): PlantNode[] {
  if (!node.parentId) return [];
  const parent = state.nodes[node.parentId];
  if (!parent) return [];
  return parent.childrenIds
    .map((id) => state.nodes[id])
    .filter((n): n is PlantNode => n !== undefined && n.id !== node.id);
}

/** Check if a node is a leaf (has no children) */
export function isLeafNode(node: PlantNode): boolean {
  return node.childrenIds.length === 0;
}

/** Check if a node is the root (has no parent) */
export function isRootNode(node: PlantNode): boolean {
  return node.parentId === null;
}

/** Get all ancestor nodes from this node up to the root */
export function getAncestors(state: GameState, node: PlantNode): PlantNode[] {
  const ancestors: PlantNode[] = [];
  let current = getParent(state, node);
  while (current) {
    ancestors.push(current);
    current = getParent(state, current);
  }
  return ancestors;
}

/** Get all descendant nodes (recursive children) */
export function getDescendants(state: GameState, node: PlantNode): PlantNode[] {
  const descendants: PlantNode[] = [];
  const stack = [...getChildren(state, node)];
  while (stack.length > 0) {
    const current = stack.pop()!;
    descendants.push(current);
    stack.push(...getChildren(state, current));
  }
  return descendants;
}

/** Get the path from one node to another (via common ancestor) */
export function getPath(
  state: GameState,
  fromId: string,
  toId: string
): PlantNode[] | null {
  const fromNode = state.nodes[fromId];
  const toNode = state.nodes[toId];
  if (!fromNode || !toNode) return null;

  // Get ancestors for both nodes
  const fromAncestors = new Set([fromId, ...getAncestors(state, fromNode).map((n) => n.id)]);
  const toAncestors = [toId, ...getAncestors(state, toNode).map((n) => n.id)];

  // Find common ancestor
  let commonAncestorId: string | null = null;
  for (const id of toAncestors) {
    if (fromAncestors.has(id)) {
      commonAncestorId = id;
      break;
    }
  }

  if (!commonAncestorId) return null;

  // Build path: from -> common ancestor -> to
  const pathUp: PlantNode[] = [fromNode];
  let current = fromNode;
  while (current.id !== commonAncestorId) {
    const parent = getParent(state, current);
    if (!parent) break;
    pathUp.push(parent);
    current = parent;
  }

  const pathDown: PlantNode[] = [];
  current = toNode;
  while (current.id !== commonAncestorId) {
    pathDown.unshift(current);
    const parent = getParent(state, current);
    if (!parent) break;
    current = parent;
  }

  return [...pathUp, ...pathDown];
}

/** Get the depth of a node (distance from root) */
export function getDepth(state: GameState, node: PlantNode): number {
  return getAncestors(state, node).length;
}

/** Get all nodes of a specific type */
export function getNodesByType(
  state: GameState,
  type: PlantNode['type']
): PlantNode[] {
  return Object.values(state.nodes).filter((n) => n.type === type);
}

/** Get all active nodes */
export function getActiveNodes(state: GameState): PlantNode[] {
  return Object.values(state.nodes).filter((n) => n.isActive);
}

/** Get all tip nodes (leaves and root tips - nodes with no children) */
export function getTipNodes(state: GameState): PlantNode[] {
  return Object.values(state.nodes).filter((n) => isLeafNode(n));
}

/** Traverse the tree in pre-order (root first, then children) */
export function traversePreOrder(
  state: GameState,
  startNode: PlantNode,
  callback: (node: PlantNode) => void
): void {
  callback(startNode);
  for (const child of getChildren(state, startNode)) {
    traversePreOrder(state, child, callback);
  }
}

/** Traverse the tree in post-order (children first, then root) */
export function traversePostOrder(
  state: GameState,
  startNode: PlantNode,
  callback: (node: PlantNode) => void
): void {
  for (const child of getChildren(state, startNode)) {
    traversePostOrder(state, child, callback);
  }
  callback(startNode);
}

/** Calculate total subtree mass (sum of all radii in subtree) */
export function getSubtreeMass(state: GameState, node: PlantNode): number {
  let mass = node.radius;
  for (const child of getChildren(state, node)) {
    mass += getSubtreeMass(state, child);
  }
  return mass;
}
