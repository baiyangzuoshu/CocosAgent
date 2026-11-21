import { CCAssetManager } from "./cocos2d/core/asset-manager/CCAssetManager.ts";
import { JsonAsset } from "./cocos2d/core/assets/CCJsonAsset.ts";
import { Prefab, type PrefabNode } from "./cocos2d/core/assets/CCPrefab.ts";
import { Texture2D } from "./cocos2d/core/assets/CCTexture2D.ts";
import { assetTypes, implementedAssetClasses } from "./cocos2d/core/assets/asset-types.ts";

const status = document.querySelector<HTMLPreElement>("#status");
if (!status) throw new Error("找不到页面状态节点 #status");

const assetManager = new CCAssetManager();
const uuid = "hero-uuid";
class LessonNode implements PrefabNode {
  _instantiate(): LessonNode {
    return new LessonNode();
  }
}
const prefab = new Prefab("prefab-uuid", new LessonNode());
const prefabA = prefab._instantiate();
const prefabB = prefab._instantiate();
const texture = new Texture2D("texture-uuid");
texture.nativeAsset = {
  _compressed: true,
  _data: new Uint8Array([255, 0, 0, 255]),
  format: 1,
  width: 1,
  height: 1,
};
const cachedBeforeFirstRequest = assetManager.assets.has(uuid);
status.textContent = "首次资源请求中……";

assetManager.loadAny(uuid, (firstError, firstAsset) => {
  if (firstError || !firstAsset) {
    status.textContent = `资源加载失败: ${firstError?.message ?? "未知错误"}`;
    return;
  }

  const cachedBeforeSecondRequest = assetManager.assets.has(uuid);
  assetManager.loadAny(uuid, (secondError, secondAsset) => {
    if (secondError || !secondAsset) {
      status.textContent = `资源加载失败: ${secondError?.message ?? "未知错误"}`;
      return;
    }

    status.textContent = [
      `资源对象: ${firstAsset instanceof JsonAsset ? firstAsset.json.name : "未知类型"}`,
      `实际类型: ${firstAsset.constructor.name}`,
      `属于 JsonAsset: ${firstAsset instanceof JsonAsset}`,
      `首次请求前有缓存: ${cachedBeforeFirstRequest}`,
      `再次请求前有缓存: ${cachedBeforeSecondRequest}`,
      `两次请求是同一对象: ${firstAsset === secondAsset}`,
      `Prefab 实例化次数: ${prefab.instantiatedTimes}`,
      `Prefab 两个实例互相独立: ${prefabA !== prefabB}`,
      `Texture2D nativeAsset 类型: ${texture.nativeAsset?.constructor.name}`,
      `Texture2D 尺寸: ${texture.width} x ${texture.height}`,
      `代码中的 Asset 子类模型: ${implementedAssetClasses.length}`,
      "",
      `Creator 2.4.15 Asset 类型索引 (${assetTypes.length})：`,
      ...assetTypes.map((type) =>
        `- ${type.group} / ${type.name}${type.parent ? ` extends ${type.parent}` : ""}: ${type.role}`
      ),
    ].join("\n");
  });
});
