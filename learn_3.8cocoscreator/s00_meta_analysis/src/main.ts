interface SubMeta {
  uuid: string;
  importer: string;
  name?: string;
  subMetas: Record<string, SubMeta>;
}

interface AssetMeta {
  uuid: string;
  importer: string;
  subMetas: Record<string, SubMeta>;
}

const sampleUrl = new URL("../samples/default_skybox.png.meta.sample.json", import.meta.url);
const meta = JSON.parse(await Deno.readTextFile(sampleUrl)) as AssetMeta;
const [subId, textureCube] = Object.entries(meta.subMetas)[0] ?? [];
const [faceId, face] = Object.entries(textureCube?.subMetas ?? {})[0] ?? [];

if (!subId || !textureCube || !faceId || !face) throw new Error("样例中没有完整的子资源链");

console.log(`主资源: ${meta.importer} ${meta.uuid}`);
console.log(`子资源: ${subId} / ${textureCube.importer} ${textureCube.uuid}`);
console.log(`嵌套子资源: ${faceId} / ${face.name} ${face.uuid}`);
