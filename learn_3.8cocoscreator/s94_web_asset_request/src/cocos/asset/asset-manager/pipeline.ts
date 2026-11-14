import { Loader } from "./load.ts";
import type { PipelineTask } from "./types.ts";

/** 本课的 load 管线保留源码中的 preprocess → load 两个入口阶段。 */
export class Pipeline {
  constructor(private readonly loader: Loader, private readonly trace: string[]) {}

  async run(uuid: string): Promise<PipelineTask> {
    this.trace.push("pipeline load: preprocess → load");
    const prepared = this.loader.preprocess({ uuid });
    return this.loader.load(prepared);
  }
}
