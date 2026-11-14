import { BundleConfig } from "./config.ts";
import { createRequestItem } from "./request-item.ts";
import type { PipelineTask } from "./types.ts";

/** 把 UUID 请求补全为 Runtime 后续阶段需要的 RequestItem。 */
export class Preprocessor {
  constructor(private readonly config: BundleConfig, private readonly trace: string[]) {}

  run(task: PipelineTask): PipelineTask {
    const record = this.config.getAsset(task.uuid);
    const request = createRequestItem(record);
    this.trace.push("preprocess: " + request.id + " → " + request.url);
    return { ...task, request };
  }
}
