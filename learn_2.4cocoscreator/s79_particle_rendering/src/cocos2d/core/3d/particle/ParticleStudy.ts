type Particle = { x: number; y: number; size: number; color: [number, number, number, number]; material: string };
type Vertex = { x: number; y: number; u: number; v: number; color: Particle['color'] };
type Batch = { vertices: Vertex[]; indices: number[] };
class ParticleBatchModel {
    readonly batches = new Map<string, Batch>();
    append(material: string, vertices: Vertex[]): void {
        const batch = this.batches.get(material) ?? { vertices: [], indices: [] };
        const base = batch.vertices.length;
        batch.vertices.push(...vertices);
        batch.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        this.batches.set(material, batch);
    }
}
class ParticleSystem3DRenderer {
    build(particles: readonly Particle[]): ParticleBatchModel {
        const model = new ParticleBatchModel();
        for (const p of particles) {
            const s = p.size * 0.5;
            const vertices: Vertex[] = [
                { x: p.x - s, y: p.y - s, u: 0, v: 0, color: p.color },
                { x: p.x + s, y: p.y - s, u: 1, v: 0, color: p.color },
                { x: p.x + s, y: p.y + s, u: 1, v: 1, color: p.color },
                { x: p.x - s, y: p.y + s, u: 0, v: 1, color: p.color },
            ];
            model.append(p.material, vertices);
        }
        return model;
    }
}
export function runLesson(): string[] {
    const particles: Particle[] = [
        { x: 1, y: 2, size: 1, color: [1, 0, 0, 1], material: 'smoke' },
        { x: 3, y: 2, size: 0.5, color: [1, 1, 1, 0.7], material: 'smoke' },
    ];
    const model = new ParticleSystem3DRenderer().build(particles);
    const batch = model.batches.get('smoke') ?? { vertices: [], indices: [] };
    return [`particles=${particles.length}; batch count=${model.batches.size}`, `smoke batch vertices=${batch.vertices.length}; indices=${batch.indices.join(',')}`, `first vertex=(${batch.vertices[0].x}, ${batch.vertices[0].y}, uv=${batch.vertices[0].u},${batch.vertices[0].v})`];
}
