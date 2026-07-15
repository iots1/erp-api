import {
  NestedSetNode,
  rebuildNestedSet,
  rebuildNestedSetFor,
} from './rebuild-nested-set.util';

function node(id: string, parentId: string | null): NestedSetNode {
  return { id, parentId, lft: 0, rgt: 0 };
}

describe('rebuildNestedSet', () => {
  it('assigns classic lft/rgt pre-order numbering for a simple tree', () => {
    // root
    // ├── a
    // │   └── a1
    // └── b
    const root = node('root', null);
    const a = node('a', 'root');
    const a1 = node('a1', 'a');
    const b = node('b', 'root');

    // Sibling left-to-right order follows input array order (per parent) —
    // not guaranteed to match any particular field — so assert containment
    // relationships (the actual nested-set invariant) rather than exact numbers.
    rebuildNestedSet([b, a1, a, root]);

    // Every [lft, rgt] pair is unique and forms a contiguous 1..2N range.
    const bounds = [root, a, a1, b]
      .flatMap((n) => [n.lft, n.rgt])
      .sort((x, y) => x - y);
    expect(bounds).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // root fully contains everything.
    expect(root.lft).toBeLessThan(a.lft);
    expect(root.lft).toBeLessThan(b.lft);
    expect(root.rgt).toBeGreaterThan(a.rgt);
    expect(root.rgt).toBeGreaterThan(b.rgt);

    // a fully contains a1 (its only child).
    expect(a.lft).toBeLessThan(a1.lft);
    expect(a.rgt).toBeGreaterThan(a1.rgt);

    // a and b are siblings — non-overlapping ranges.
    expect(a.rgt < b.lft || b.rgt < a.lft).toBe(true);
  });

  it('supports multiple root nodes (forest), each a disjoint range', () => {
    const root1 = node('root1', null);
    const root2 = node('root2', null);
    const child = node('child', 'root1');

    rebuildNestedSet([root2, child, root1]);

    const bounds = [root1, root2, child]
      .flatMap((n) => [n.lft, n.rgt])
      .sort((x, y) => x - y);
    expect(bounds).toEqual([1, 2, 3, 4, 5, 6]);

    expect(root1.lft).toBeLessThan(child.lft);
    expect(root1.rgt).toBeGreaterThan(child.rgt);
    expect(root1.rgt < root2.lft || root2.rgt < root1.lft).toBe(true);
  });

  it('throws when a node references a parent outside the given set (orphan/cycle)', () => {
    const child = node('child', 'missing-parent');

    expect(() => rebuildNestedSet([child])).toThrow(/orphan\/cyclic/);
  });

  it('mutates and returns the same array reference', () => {
    const nodes = [node('root', null)];
    const result = rebuildNestedSet(nodes);
    expect(result).toBe(nodes);
  });
});

describe('rebuildNestedSetFor', () => {
  interface ItemGroupLike {
    id: string;
    parent_item_group_id: string | null;
    lft: number;
    rgt: number;
  }

  function group(id: string, parentId: string | null): ItemGroupLike {
    return { id, parent_item_group_id: parentId, lft: 0, rgt: 0 };
  }

  it('writes lft/rgt back onto entities keyed by a custom parent-FK accessor', () => {
    const root = group('root', null);
    const child = group('child', 'root');

    const result = rebuildNestedSetFor(
      [child, root],
      (entity) => entity.parent_item_group_id,
    );

    expect(root.lft).toBe(1);
    expect(child.lft).toBe(2);
    expect(child.rgt).toBe(3);
    expect(root.rgt).toBe(4);
    expect(result).toEqual([child, root]);
  });
});
