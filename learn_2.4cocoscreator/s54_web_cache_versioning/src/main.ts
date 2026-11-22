import { combine } from "./cocos2d/core/asset-manager/urlTransformer.ts";
import { cacheControlFor } from "./deploy/CachePolicy.ts";
import { publishSteps, ReleasePublishPlan, rollbackStep, validateManifest } from "./deploy/ReleaseManifest.ts";
import type { ReleaseManifest } from "./deploy/ReleaseManifest.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const write = (message: string): void => {
  if (output) output.textContent += message + "\n";
  console.log(message);
};

async function start(): Promise<void> {
  const response = await fetch("./release.json", { cache: "no-cache" });
  const manifest = await response.json() as ReleaseManifest;
  const assetUrl = combine(manifest, {
    uuid: "ab12cd34",
    version: "ef56",
    extension: ".json",
  });
  const issues = validateManifest(manifest);
  if (issues.length) throw new Error(issues.join("; "));
  const publish = new ReleasePublishPlan(manifest, [assetUrl]);
  publish.markUploaded([assetUrl]);
  publish.verify((path) => path.startsWith(manifest.base + "/"));
  publish.activate();

  write("Active release: " + manifest.releaseId);
  write("Creator 2.4 import URL: " + assetUrl);
  write("Cache-Control /index.html: " + cacheControlFor("/index.html"));
  write("Cache-Control /release.json: " + cacheControlFor("/release.json"));
  write("Cache-Control versioned asset: " + cacheControlFor(assetUrl));
  write("Publish order:");
  for (const step of publishSteps(manifest)) write("  " + step);
  write("Publisher phase after simulated verification: " + publish.phase);
  write("Rollback: " + rollbackStep(manifest));
  publish.rollback();
  write("Rollback state transition: " + publish.phase);
}

void start().catch((error: unknown) => write("Could not load release.json: " + String(error)));
