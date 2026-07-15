/**
 * Minimal shape a nested-set tree entity must satisfy for {@link rebuildNestedSet}.
 * `parentId` is the FK column value (e.g. `parent_item_group_id`), `lft`/`rgt`
 * are plain integer columns recomputed by this helper.
 */
export interface NestedSetNode {
  id: string;
  parentId: string | null;
  lft: number;
  rgt: number;
}

/**
 * Recomputes `lft`/`rgt` for an entire nested-set tree via a pre-order walk.
 *
 * Call inside a transaction after any insert/re-parent/delete — per the
 * "RULE · NESTED-SET TREE" convention (see CLAUDE.md / backend-convention.html),
 * the whole tree is rebuilt rather than incrementally patched, which is simple
 * to reason about and cheap enough for master-data-sized trees (item groups,
 * warehouses).
 *
 * @param nodes All non-deleted nodes of the tree (single query, no relations needed).
 * @returns The same nodes with `lft`/`rgt` mutated in place, plus the array for convenience.
 */
export function rebuildNestedSet<T extends NestedSetNode>(nodes: T[]): T[] {
  const byParent = new Map<string | null, T[]>();
  for (const node of nodes) {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }

  let counter = 1;
  const visited = new Set<string>();

  const visit = (parentId: string | null): void => {
    const children = byParent.get(parentId) ?? [];
    for (const child of children) {
      visited.add(child.id);
      child.lft = counter++;
      visit(child.id);
      child.rgt = counter++;
    }
  };

  visit(null);

  const orphans = nodes.filter((n) => !visited.has(n.id));
  if (orphans.length > 0) {
    throw new Error(
      `rebuildNestedSet: detected ${orphans.length} orphan/cyclic node(s) not reachable from a root: ${orphans
        .map((n) => n.id)
        .join(', ')}`,
    );
  }

  return nodes;
}

/**
 * Convenience wrapper for entities whose parent FK isn't literally named
 * `parentId` (e.g. `parent_item_group_id`, `parent_warehouse_id`). Builds the
 * plain {@link NestedSetNode} mirror, rebuilds it, then writes `lft`/`rgt` back
 * onto the original entity objects (mutated in place) so callers can just
 * `repo.save(entities)` afterwards.
 *
 * @param entities All non-deleted rows of the tree.
 * @param getParentId Reads the FK column off an entity (e.g. `(e) => e.parent_item_group_id`).
 */
export function rebuildNestedSetFor<
  T extends { id: string; lft: number; rgt: number },
>(entities: T[], getParentId: (entity: T) => string | null): T[] {
  const mirrors = entities.map((entity) => ({
    id: entity.id,
    parentId: getParentId(entity),
    lft: entity.lft,
    rgt: entity.rgt,
  }));

  rebuildNestedSet(mirrors);

  const byId = new Map(mirrors.map((mirror) => [mirror.id, mirror]));
  for (const entity of entities) {
    const mirror = byId.get(entity.id);
    if (mirror) {
      entity.lft = mirror.lft;
      entity.rgt = mirror.rgt;
    }
  }

  return entities;
}
