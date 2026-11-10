export class MeshRenderData {
  vData: Float32Array;
  iData: Uint16Array;
  vertexCount = 0;
  indexCount = 0;
  attributesReady = false;
  material = "ParticleMaterial";
  frame = "";

  constructor(readonly capacity: number) {
    this.vData = new Float32Array(capacity * 8);
    this.iData = new Uint16Array(capacity * 6);
  }

  reset(): void {
    this.vertexCount = 0;
    this.indexCount = 0;
    this.attributesReady = false;
  }

  request(vertexCount: number, indexCount: number): void {
    this.vertexCount = vertexCount;
    this.indexCount = indexCount;
    for (let i = 0; i < indexCount / 6; i += 1) {
      const vertex = i * 4;
      const offset = i * 6;
      this.iData.set([vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2], offset);
    }
  }

  writeQuad(index: number, x: number, y: number): void {
    const offset = index * 8;
    this.vData.set([x - 0.5, y - 0.5, x + 0.5, y - 0.5, x - 0.5, y + 0.5, x + 0.5, y + 0.5], offset);
  }

  setRenderDrawInfoAttributes(): void {
    this.attributesReady = true;
  }

  clear(): void {
    this.reset();
  }
}

export class ParticleAssembler {
  removedData = 0;

  createData(capacity: number): MeshRenderData {
    return new MeshRenderData(capacity);
  }

  removeData(_data: MeshRenderData): void {
    this.removedData += 1;
  }
}

export class ParticleBatcher {
  commits = 0;
  submittedIndices = 0;

  commitComp(data: MeshRenderData): void {
    if (data.indexCount === 0) return;
    this.commits += 1;
    this.submittedIndices += data.indexCount;
  }
}
