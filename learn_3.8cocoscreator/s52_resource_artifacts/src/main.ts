import { resolveBundleUrl, type AssetFile, type BundleBases } from "./asset/BundleFileLayout.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += message + "\n"; };

const bases: BundleBases = { base: "/assets/resources/", importBase: "import/", nativeBase: "native/" };
const asset: AssetFile = {
  uuid: "0123456789abcdef0123456789abcdef",
  importExtension: ".json",
  nativeExtension: ".png",
  version: "a1b2c3",
  nativeVersion: "d4e5f6",
  overrideUuid: "fedcba9876543210fedcba9876543210",
};

log("Creator 3.8 runtime bundle paths");
log("import=" + resolveBundleUrl(bases, asset, false));
log("native=" + resolveBundleUrl(bases, asset, true));
log("bundle metadata maps UUID/path/version to files; these sample names are illustrative");
log("scope=static source model; no Creator 3.8 editor build or runtime validation");
