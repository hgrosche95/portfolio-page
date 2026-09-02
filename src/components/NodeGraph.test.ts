import { describe, expect, it } from 'vitest';
import { computeDepths, type Architecture } from './NodeGraph';

describe('computeDepths', () => {
  it('assigns depth 0 to nodes nothing points at', () => {
    const architecture: Architecture = {
      nodes: [{ id: 'a', label: 'A', kind: 'frontend' }],
      edges: [],
    };
    expect(computeDepths(architecture).get('a')).toBe(0);
  });

  it('places each node one column past its deepest predecessor', () => {
    const architecture: Architecture = {
      nodes: [
        { id: 'a', label: 'A', kind: 'frontend' },
        { id: 'b', label: 'B', kind: 'backend' },
        { id: 'c', label: 'C', kind: 'data' },
      ],
      edges: [
        ['a', 'b'],
        ['b', 'c'],
      ],
    };
    const depths = computeDepths(architecture);
    expect(depths.get('a')).toBe(0);
    expect(depths.get('b')).toBe(1);
    expect(depths.get('c')).toBe(2);
  });

  it('uses the deepest predecessor when a node has several', () => {
    // a -> c, b -> c, with b one column further right than a: c must land
    // past b, not just past a.
    const architecture: Architecture = {
      nodes: [
        { id: 'a', label: 'A', kind: 'frontend' },
        { id: 'x', label: 'X', kind: 'backend' },
        { id: 'b', label: 'B', kind: 'backend' },
        { id: 'c', label: 'C', kind: 'data' },
      ],
      edges: [
        ['a', 'c'],
        ['a', 'x'],
        ['x', 'b'],
        ['b', 'c'],
      ],
    };
    const depths = computeDepths(architecture);
    expect(depths.get('c')).toBe(3);
  });

  it('settles instead of looping forever on a cycle', () => {
    const architecture: Architecture = {
      nodes: [
        { id: 'a', label: 'A', kind: 'frontend' },
        { id: 'b', label: 'B', kind: 'backend' },
      ],
      edges: [
        ['a', 'b'],
        ['b', 'a'],
      ],
    };
    const depths = computeDepths(architecture);
    expect(depths.get('a')).toBeGreaterThanOrEqual(0);
    expect(depths.get('b')).toBeGreaterThanOrEqual(0);
  });
});
