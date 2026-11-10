export class Director {
  constructor(private readonly write: (message: string) => void) {}

  loadScene(sceneName: string, onLaunched: () => void): void {
    this.write("Director.loadScene(" + sceneName + ")");
    this.write("Director: scene activated and animation started");
    onLaunched();
  }
}
