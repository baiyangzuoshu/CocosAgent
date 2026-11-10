/** Course-only sink that exposes normalized progress for the browser demo. */
import { CCActionInterval } from "./CCActionInterval.ts";

export default class CCProgressAction extends CCActionInterval {
  constructor(
    duration: number,
    private readonly onProgress: (progress: number) => void,
    private readonly easing: (progress: number) => number = (progress) => progress,
  ) {
    super(duration);
  }

  update(progress: number): void {
    this.onProgress(this.easing(progress));
  }
}
