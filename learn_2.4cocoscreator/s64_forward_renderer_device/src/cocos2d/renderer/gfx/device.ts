export interface InputAssembler {
  readonly name: string;
  readonly indexCount: number;
  readonly indexed: boolean;
}

export class Device {
  setVertexBuffer(name: string): void {
    console.log("Device.setVertexBuffer", name);
  }

  setIndexBuffer(name: string): void {
    console.log("Device.setIndexBuffer", name);
  }

  setProgram(name: string): void {
    console.log("Device.setProgram", name);
  }

  setPassState(name: string): void {
    console.log("Device.applyPassState", name);
  }

  draw(assembler: InputAssembler): void {
    if (assembler.indexed) {
      console.log("WebGL gl.drawElements(TRIANGLES,", assembler.indexCount, ")");
    } else {
      console.log("WebGL gl.drawArrays(TRIANGLES,", assembler.indexCount, ")");
    }
  }
}
