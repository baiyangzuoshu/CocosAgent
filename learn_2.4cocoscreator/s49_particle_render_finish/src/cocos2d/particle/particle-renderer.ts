export class ParticleVertexBuffer {
  vertices = new Float32Array(0);
  indices = new Uint16Array(0);
  vertexCount = 0;
  indexCount = 0;
  uploadCount = 0;
  destroyed = false;

  setCapacity(particleCount: number): void {
    this.vertices = new Float32Array(particleCount * 8);
    this.indices = new Uint16Array(particleCount * 6);
  }

  request(particleCount: number): void {
    this.vertexCount = particleCount * 4;
    this.indexCount = particleCount * 6;
    for (let i = 0; i < particleCount; i += 1) {
      const vertex = i * 4;
      const index = i * 6;
      this.indices.set([vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2], index);
    }
  }

  writeQuad(index: number, x: number, y: number): void {
    const offset = index * 8;
    this.vertices.set([x - 0.5, y - 0.5, x + 0.5, y - 0.5, x - 0.5, y + 0.5, x + 0.5, y + 0.5], offset);
  }

  uploadData(): void {
    if (!this.destroyed) this.uploadCount += 1;
  }

  clear(): void {
    this.vertexCount = 0;
    this.indexCount = 0;
  }

  destroy(): void {
    this.clear();
    this.destroyed = true;
  }
}

export class InputAssembler {
  _count = 0;
}

export class ParticleAssembler {
  readonly buffer = new ParticleVertexBuffer();
  readonly _ia = new InputAssembler();

  setCapacity(particleCount: number): void {
    this.buffer.setCapacity(particleCount);
  }

  updateParticles(particles: ReadonlyArray<{ x: number; y: number }>): void {
    this.buffer.request(particles.length);
    particles.forEach((particle, index) => this.buffer.writeQuad(index, particle.x, particle.y));
    this._ia._count = this.buffer.indexCount;
    if (particles.length > 0) this.buffer.uploadData();
  }

  fillBuffers(renderer: WebRenderer): void {
    if (this._ia._count > 0) renderer.flushIA(this._ia);
  }

  clear(): void {
    this.buffer.clear();
    this._ia._count = 0;
  }

  destroy(): void {
    this.buffer.destroy();
    this._ia._count = 0;
  }
}

export class WebRenderer {
  submissions = 0;
  submittedIndices = 0;

  flushIA(inputAssembler: InputAssembler): void {
    if (inputAssembler._count === 0) return;
    this.submissions += 1;
    this.submittedIndices += inputAssembler._count;
  }
}
