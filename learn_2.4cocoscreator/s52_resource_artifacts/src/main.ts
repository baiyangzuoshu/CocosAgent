import { BundleConfig, combineUrl, resolvePath, type BundleRecord, type RequestItem } from "./asset/BundleFileLayout.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += `${message}\n`; };

const spriteUuid = "0123456789abcdef0123456789abcdef";
const textureUuid = "fedcba9876543210fedcba9876543210";
const sceneUuid = "11111111111111111111111111111111";
const bundleRecord: BundleRecord = {
  name: "resources", base: "/assets/", importBase: "resources/import", nativeBase: "resources/native",
  uuids: [spriteUuid, textureUuid, sceneUuid],
  paths: {
    [spriteUuid]: ["Texture/hero", "cc.SpriteFrame"],
    [textureUuid]: ["Texture/hero", "cc.Texture2D", true],
    [sceneUuid]: ["Scene/level", "cc.SceneAsset"],
  },
  scenes: { "db://assets/Scene/level.fire": sceneUuid },
  packs: { "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": [spriteUuid, sceneUuid] },
  versions: { import: [spriteUuid, "i-a81f", sceneUuid, "i-135b"], native: [textureUuid, "n-c902"] },
};
const config = new BundleConfig(bundleRecord);

log("Creator 2.4.15 Bundle Config construction");
log(`bundle=${bundleRecord.name}; base=${bundleRecord.base}; importBase=${bundleRecord.importBase}; nativeBase=${bundleRecord.nativeBase}`);
log(`UUID index: ${config.assets.size} records (including the pack record)`);
log(`path lookup Texture/hero -> ${config.getInfoWithPath("Texture/hero")?.uuid} (main asset wins before sub-assets)`);
log(`scene lookup -> ${config.getSceneInfo("db://assets/Scene/level.fire")?.uuid}`);
log(`pack aaaa... contains -> ${config.packContents.get("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")?.join(", ")}`);

const requests: RequestItem[] = [
  { uuid: spriteUuid, extension: ".json", native: false },
  { uuid: textureUuid, extension: ".png", native: true },
  { uuid: textureUuid, extension: ".ttf", native: true, nativeName: "NotoSans-Regular.ttf" },
];
for (const item of requests) {
  const info = config.getAssetInfo(item.uuid);
  log(`${item.native ? "native" : "import"} UUID=${item.uuid} ver=${item.native ? info?.nativeVersion ?? "(none)" : info?.version ?? "(none)"}`);
  log(`  => ${combineUrl(config, item)}`);
}
const byPath = resolvePath(config, "Texture/hero", "cc.SpriteFrame");
log(`path request + type filter => ${combineUrl(config, { uuid: byPath.uuid, extension: ".json", native: false, info: byPath })}`);
log("boundary: in-memory teaching config models runtime indexing/URL mapping; no .meta import, pack fetch, or Editor build occurs");
