export interface WebReleasePlan {
  entryUrl: string;
  entryPolicy: string;
  assetBase: string;
  assetPolicy: string;
  startScene: string;
}

export function createWebReleasePlan(releaseId: string, startScene: string): WebReleasePlan {
  return {
    entryUrl: "/index.html",
    entryPolicy: "revalidate to discover a new release",
    assetBase: "/releases/" + releaseId + "/",
    assetPolicy: "keep files for this release unchanged",
    startScene,
  };
}
