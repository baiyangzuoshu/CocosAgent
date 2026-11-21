type Vertex = { x: number; y: number; u: number; v: number };
type Submesh = { texture: string; material: string; vertices: Vertex[]; indices: number[] };
type Batch = { texture: string; material: string; vertices: Vertex[]; indices: number[] };
class SpineBuffer {
    readonly batches: Batch[] = [];
    private current: Batch | null = null;
    append(mesh: Submesh): void {
        if (!this.current || this.current.texture !== mesh.texture || this.current.material !== mesh.material) {
            this.flush();
            this.current = { texture: mesh.texture, material: mesh.material, vertices: [], indices: [] };
        }
        const base = this.current.vertices.length;
        this.current.vertices.push(...mesh.vertices);
        this.current.indices.push(...mesh.indices.map((index) => index + base));
    }
    flush(): void {
        if (this.current && this.current.indices.length) this.batches.push(this.current);
        this.current = null;
    }
    finish(): readonly Batch[] { this.flush(); return this.batches; }
}
export function runLesson(): string[] {
    const mesh = (texture: string, material: string, x: number): Submesh => ({
        texture, material,
        vertices: [{ x, y: 0, u: 0, v: 0 }, { x: x + 1, y: 0, u: 1, v: 0 }, { x, y: 1, u: 0, v: 1 }],
        indices: [0, 1, 2],
    });
    const buffer = new SpineBuffer();
    buffer.append(mesh('atlasA', 'skeleton', 0));
    buffer.append(mesh('atlasA', 'skeleton', 2));
    buffer.append(mesh('atlasB', 'skeleton', 4));
    const batches = buffer.finish();
    return batches.map((batch, i) => `batch ${i}: texture=${batch.texture}, vertices=${batch.vertices.length}, indices=${batch.indices.join(',')}`);
}
