type Point = { x: number; y: number };
type Triangle = [number, number, number];
type PointTriangle = [Point, Point, Point];
function clipTriangleAgainstRect(triangle: PointTriangle, rect: { left: number; right: number; bottom: number; top: number }): Point[] {
    let polygon: Point[] = [...triangle];
    const edges = [
        { inside: (p: Point) => p.x >= rect.left, intersect: (a: Point, b: Point): Point => ({ x: rect.left, y: a.y + (b.y - a.y) * (rect.left - a.x) / (b.x - a.x) }) },
        { inside: (p: Point) => p.x <= rect.right, intersect: (a: Point, b: Point): Point => ({ x: rect.right, y: a.y + (b.y - a.y) * (rect.right - a.x) / (b.x - a.x) }) },
        { inside: (p: Point) => p.y >= rect.bottom, intersect: (a: Point, b: Point): Point => ({ x: a.x + (b.x - a.x) * (rect.bottom - a.y) / (b.y - a.y), y: rect.bottom }) },
        { inside: (p: Point) => p.y <= rect.top, intersect: (a: Point, b: Point): Point => ({ x: a.x + (b.x - a.x) * (rect.top - a.y) / (b.y - a.y), y: rect.top }) },
    ];
    for (const edge of edges) {
        const input = polygon;
        polygon = [];
        for (let i = 0; i < input.length; i++) {
            const current = input[i];
            const previous = input[(i + input.length - 1) % input.length];
            const currentInside = edge.inside(current);
            const previousInside = edge.inside(previous);
            if (currentInside) {
                if (!previousInside) polygon.push(edge.intersect(previous, current));
                polygon.push(current);
            } else if (previousInside) polygon.push(edge.intersect(previous, current));
        }
    }
    return polygon;
}
class MeshAttachment {
    constructor(readonly vertices: readonly Point[], readonly triangles: readonly Triangle[]) {}
    worldVertices(deform: readonly Point[], offset: Point): Point[] {
        return this.vertices.map((vertex, i) => ({ x: vertex.x + (deform[i]?.x ?? 0) + offset.x, y: vertex.y + (deform[i]?.y ?? 0) + offset.y }));
    }
    worldTriangles(worldVertices: readonly Point[]): PointTriangle[] {
        return this.triangles.map(([a, b, c]) => [worldVertices[a], worldVertices[b], worldVertices[c]]);
    }
}
export function runLesson(): string[] {
    const mesh = new MeshAttachment([{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }, { x: -1, y: 2 }], [
        [0, 1, 2],
        [0, 2, 3],
    ]);
    const worldVertices = mesh.worldVertices([{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0 }], { x: 1, y: 0 });
    const worldTriangles = mesh.worldTriangles(worldVertices);
    const clipped = worldTriangles.map((triangle) => clipTriangleAgainstRect(triangle, { left: 0, right: 1.5, bottom: 0, top: 2 }));
    return [`deform + world offset changed vertex[1].x=${worldVertices[1].x}`, `triangle vertex counts before=3,3 after=${clipped.map((p) => p.length).join(',')}`, 'rectangle clipping is a teaching simplification of SkeletonClipping'];
}
