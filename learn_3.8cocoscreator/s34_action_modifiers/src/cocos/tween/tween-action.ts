import { ActionInterval } from "./actions/action-interval.ts";

export default class TweenAction extends ActionInterval {
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
