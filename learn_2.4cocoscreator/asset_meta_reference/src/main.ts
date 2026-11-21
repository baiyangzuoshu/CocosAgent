interface SubMeta {
  uuid: string;
  importer: string;
  rawTextureUuid?: string;
}

interface AssetMeta {
  uuid: string;
  importer: string;
  subMetas: Record<string, SubMeta>;
}

const sampleUrl = new URL("../samples/HelloWorld.png.meta.sample.json", import.meta.url);
const meta = JSON.parse(await Deno.readTextFile(sampleUrl)) as AssetMeta;
const [subName, subMeta] = Object.entries(meta.subMetas)[0] ?? [];

if (!subName || !subMeta) throw new Error("样例中没有子资源");

console.log(`主资源: ${meta.importer} ${meta.uuid}`);
console.log(`子资源: ${subName} / ${subMeta.importer} ${subMeta.uuid}`);
console.log(`rawTextureUuid 指向主资源: ${subMeta.rawTextureUuid === meta.uuid}`);
console.log(`主资源与子资源 UUID 不同: ${meta.uuid !== subMeta.uuid}`);
console.log(`样例覆盖的子资源数量: ${Object.keys(meta.subMetas).length}`);
