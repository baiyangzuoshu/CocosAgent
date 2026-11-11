import { combine } from "./cocos/asset/asset-manager/url-transformer.ts";
import { cacheControlFor } from "./deploy/CachePolicy.ts";
import { publishSteps, rollbackStep } from "./deploy/ReleaseManifest.ts";
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
    overrideUuid: "cd34ef56",
    version: "7890",
    extension: ".json",
  });

  write("Active release: " + manifest.releaseId);
  write("Creator 3.8 import URL: " + assetUrl);
  write("Cache-Control /index.html: " + cacheControlFor("/index.html"));
  write("Cache-Control /release.json: " + cacheControlFor("/release.json"));
  write("Cache-Control versioned asset: " + cacheControlFor(assetUrl));
  write("Publish order:");
  for (const step of publishSteps(manifest)) write("  " + step);
  write("Rollback: " + rollbackStep(manifest));
}

void start().catch((error: unknown) => write("Could not load release.json: " + String(error)));
