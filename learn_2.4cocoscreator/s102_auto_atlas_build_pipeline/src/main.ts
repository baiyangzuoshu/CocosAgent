const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

interface SourceImage {
  file: string;
  textureUuid: string;
  spriteFrameUuid: string;
  width: number;
  height: number;
}

interface PackedFrame {
  name: string;
  spriteFrameUuid: string;
  atlasTextureKey: string;
  rect: [number, number, number, number];
  offset: [number, number];
  originalSize: [number, number];
  rotated: boolean;
}

interface Fixture {
  project: {
    creatorVersion: string;
    target: string;
    prefabPath: string;
    prefabUuid: string;
    prefabSpriteAtlasField: string | null;
  };
  autoAtlas: {
    path: string;
    maxWidth: number;
    maxHeight: number;
    padding: number;
    allowRotation: boolean;
    powerOfTwo: boolean;
    algorithm: string;
    filterUnused: boolean;
  };
  prefabSpriteFrameUuids: string[];
  sourceImages: SourceImage[];
  build: {
    bundle: string;
    configPath: string;
    uuidTable: string[];
    packs: Record<string, number[]>;
    nativeVersionPair: [number, string];
    atlasTexture: {
      key: string;
      path: string;
      width: number;
      height: number;
    };
    spriteFrames: PackedFrame[];
  };
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Mirrors Creator 2.4.15's compressed UUID decoding for 22-character UUIDs.
function decodeUuid(value: string): string {
  if (value.length !== 22) return value;

  let hex = value.slice(0, 2).toLowerCase();
  for (let index = 2; index < 22; index += 2) {
    const left = BASE64.indexOf(value[index]);
    const right = BASE64.indexOf(value[index + 1]);
    invariant(left >= 0 && right >= 0, "Invalid compressed UUID: " + value);
    hex += (left >> 2).toString(16);
    hex += (((left & 3) << 2) | (right >> 4)).toString(16);
    hex += (right & 15).toString(16);
  }

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

const fixtureUrl = new URL("../samples/auto-atlas-build.json", import.meta.url);
const fixture = JSON.parse(await Deno.readTextFile(fixtureUrl)) as Fixture;
const prefabFrames = new Set(fixture.prefabSpriteFrameUuids);
const buildUuidIndex = new Map<string, number>();
fixture.build.uuidTable.forEach((uuid, index) => {
  buildUuidIndex.set(decodeUuid(uuid), index);
});

const packedIndices = new Set(fixture.build.packs["0460cc30d"] ?? []);
const packedFrameByUuid = new Map(
  fixture.build.spriteFrames.map((frame) => [frame.spriteFrameUuid, frame]),
);

invariant(fixture.project.creatorVersion === "2.4.15", "Unexpected Creator version");
invariant(fixture.autoAtlas.filterUnused, "Fixture must demonstrate Filter Unused");
invariant(fixture.autoAtlas.algorithm === "MaxRects", "Unexpected atlas algorithm");
invariant(fixture.project.prefabSpriteAtlasField === null, "Prefab atlas field changed");
invariant(
  decodeUuid(fixture.build.uuidTable[0]) === fixture.project.prefabUuid,
  "Prefab UUID does not match Bundle Config",
);

const atlasIndex = buildUuidIndex.get(fixture.build.atlasTexture.key);
invariant(atlasIndex !== undefined, "Generated atlas texture key is absent from UUID table");
invariant(
  fixture.build.nativeVersionPair[0] === atlasIndex,
  "Native version entry does not point at the atlas texture",
);

console.log("Creator " + fixture.project.creatorVersion + " / " + fixture.project.target);
console.log("Auto Atlas: " + fixture.autoAtlas.path);
console.log(
  "Settings: " + fixture.autoAtlas.algorithm + ", padding=" + fixture.autoAtlas.padding +
    ", rotation=" + fixture.autoAtlas.allowRotation +
    ", Filter Unused=" + fixture.autoAtlas.filterUnused,
);
console.log("Prefab SpriteFrame references: " + prefabFrames.size);
console.log("");
console.log("Source  Frame UUID                              In Prefab  Packed  Atlas rect (x,y,w,h)  Rotated");

for (const image of fixture.sourceImages) {
  const uuidRecord = buildUuidIndex.get(image.spriteFrameUuid);
  const frame = packedFrameByUuid.get(image.spriteFrameUuid);
  const inPack = uuidRecord !== undefined && packedIndices.has(uuidRecord);
  const referenced = prefabFrames.has(image.spriteFrameUuid);

  invariant(referenced === (uuidRecord !== undefined && inPack),
    "Prefab reference and packed membership disagree for " + image.file);
  invariant(referenced === (frame !== undefined),
    "Prefab reference and atlas frame record disagree for " + image.file);

  if (fixture.autoAtlas.filterUnused && !referenced) {
    invariant(!inPack && !frame, "Unreferenced image unexpectedly entered the atlas: " + image.file);
  }

  const rect = frame ? "[" + frame.rect.join(",") + "]" : "-";
  console.log(
    image.file.padEnd(8) + " " + image.spriteFrameUuid + "  " +
      String(referenced).padEnd(9) + " " + String(inPack).padEnd(6) + " " +
      rect.padEnd(20) + " " + (frame ? String(frame.rotated) : "-"),
  );
}

console.log("");
console.log(
  "Generated texture: " + fixture.build.atlasTexture.width + "x" +
    fixture.build.atlasTexture.height + "  " + fixture.build.atlasTexture.path,
);
console.log("Packed import data: " + fixture.build.configPath);
console.log("The three SpriteFrames retain their UUIDs and share texture key " +
  fixture.build.atlasTexture.key + ".");
