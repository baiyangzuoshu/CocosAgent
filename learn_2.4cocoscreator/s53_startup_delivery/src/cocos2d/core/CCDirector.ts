export class CCDirector {
  constructor(private readonly write: (message: string) => void) {}

  loadScene(sceneName: string): void {
    this.write("cc.director.loadScene(" + sceneName + ")");
  }
}
