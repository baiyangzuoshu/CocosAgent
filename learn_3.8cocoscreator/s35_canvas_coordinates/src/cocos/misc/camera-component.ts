export default class Camera {
  orthoHeight = 0;
  readonly node = {
    position: { x: 0, y: 0, z: 0 },
    setWorldPosition: (x: number, y: number, z: number): void => {
      this.node.position = { x, y, z };
    },
  };
}
