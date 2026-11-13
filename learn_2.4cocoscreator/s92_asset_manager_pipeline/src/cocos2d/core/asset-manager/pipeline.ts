import type { AssetFile } from "./fetch.ts";
import type { CCAsset } from "../assets/CCAsset.ts";

export interface PipelineTask {
  uuid: string;
  file?: AssetFile;
  asset?: CCAsset;
}

export interface PipelineStage {
  name: string;
  run(task: PipelineTask): Promise<PipelineTask>;
}

export class Pipeline {
  constructor(readonly name: string, readonly stages: PipelineStage[], private readonly trace: string[]) {}

  describe(): string {
    return this.stages.map((stage) => stage.name).join(" → ");
  }

  async run(uuid: string): Promise<PipelineTask> {
    let task: PipelineTask = { uuid };
    this.trace.push(`pipeline ${this.name}: ${this.describe()}`);
    for (const stage of this.stages) {
      this.trace.push(`stage ${stage.name}: ${task.uuid}`);
      task = await stage.run(task);
    }
    return task;
  }
}
