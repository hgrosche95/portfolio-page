import { describe, expect, it } from 'vitest';
import { layoutSchematic, wirePath, NODE_HEIGHT, ROW_PITCH, type SchematicInput } from './schematic';

const threeLanes: SchematicInput = {
  lanes: ['Clients', 'Server', 'Daten'],
  nodes: [
    { id: 'web', lane: 0, row: 0 },
    { id: 'others', lane: 0, row: 1.3 },
    { id: 'server', lane: 1, row: 0 },
    { id: 'logic', lane: 1, row: 1.3 },
    { id: 'db', lane: 2, row: 0 },
  ],
  edges: [
    ['web', 'server'],
    ['server', 'logic'],
    ['server', 'db'],
    ['server', 'others'],
  ],
};

/** x of the vertical segment in an elbow path "M x y H gx V y2 H x2". */
const elbowX = (d: string) => Number(d.match(/H(-?[\d.]+) V/)?.[1]);

describe('layoutSchematic', () => {
  it('places boxes by lane and row', () => {
    const layout = layoutSchematic(threeLanes);
    expect(layout.boxes.web).toMatchObject({ x: 0, y: 0 });
    expect(layout.boxes.logic.y).toBeCloseTo(1.3 * ROW_PITCH);
    expect(layout.boxes.server.x).toBeGreaterThan(layout.boxes.web.x + layout.nodeWidth);
    expect(layout.boxes.db.x + layout.nodeWidth).toBeCloseTo(layout.width);
  });

  it('uses narrower boxes when there are four lanes, so they still fit', () => {
    const three = layoutSchematic(threeLanes);
    const four = layoutSchematic({ ...threeLanes, lanes: [...threeLanes.lanes, 'KI'] });
    expect(four.nodeWidth).toBeLessThan(three.nodeWidth);
  });

  it('is exactly as tall as its lowest box', () => {
    const layout = layoutSchematic(threeLanes);
    expect(layout.height).toBeCloseTo(1.3 * ROW_PITCH + NODE_HEIGHT);
  });

  it('draws one divider between each pair of neighbouring lanes', () => {
    const layout = layoutSchematic(threeLanes);
    expect(layout.dividers).toHaveLength(2);
    expect(layout.dividers[0]).toBeGreaterThan(layout.boxes.web.x + layout.nodeWidth);
    expect(layout.dividers[0]).toBeLessThan(layout.boxes.server.x);
  });

  it('gives elbows that share a gap their own vertical track', () => {
    const layout = layoutSchematic({
      lanes: ['A', 'B'],
      nodes: [
        { id: 'a1', lane: 0, row: 0 },
        { id: 'a2', lane: 0, row: 2 },
        { id: 'b1', lane: 1, row: 1 },
      ],
      edges: [
        ['a1', 'b1'],
        ['a2', 'b1'],
      ],
    });
    const [first, second] = layout.wires.map((wire) => elbowX(wire.d));
    expect(first).not.toBe(second);
  });
});

describe('wirePath', () => {
  const layout = layoutSchematic(threeLanes);

  it('runs straight when both ends sit on the same row', () => {
    const { web, server } = layout.boxes;
    const y = NODE_HEIGHT / 2;
    expect(wirePath(layout, 'web', 'server')).toBe(`M${web.x + layout.nodeWidth} ${y} H${server.x}`);
  });

  it('runs vertically between boxes in the same lane', () => {
    const { server, logic } = layout.boxes;
    const cx = server.x + layout.nodeWidth / 2;
    expect(wirePath(layout, 'server', 'logic')).toBe(`M${cx} ${NODE_HEIGHT} V${logic.y}`);
    expect(wirePath(layout, 'logic', 'server')).toBe(`M${cx} ${logic.y} V${NODE_HEIGHT}`);
  });

  it('bends in the same place in both directions', () => {
    expect(elbowX(wirePath(layout, 'server', 'others'))).toBe(elbowX(wirePath(layout, 'others', 'server')));
  });

  it('bends in the gap just before the higher lane when it skips one', () => {
    const skip = layoutSchematic({
      lanes: ['A', 'B', 'C'],
      nodes: [
        { id: 'a', lane: 0, row: 0 },
        { id: 'c', lane: 2, row: 1 },
      ],
      edges: [['a', 'c']],
    });
    // Forward and backward, the vertical must sit between lanes B and C,
    // so the horizontal run crosses B on the row that is actually free.
    expect(elbowX(wirePath(skip, 'a', 'c'))).toBeCloseTo(skip.dividers[1]);
    expect(elbowX(wirePath(skip, 'c', 'a'))).toBeCloseTo(skip.dividers[1]);
  });

  it('names the missing node instead of drawing nothing', () => {
    expect(() => wirePath(layout, 'web', 'nope')).toThrow('nope');
  });
});
