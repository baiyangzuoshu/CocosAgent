import { CCAssetManager } from "./cocos2d/core/asset-manager/CCAssetManager.ts";

const status = document.querySelector<HTMLPreElement>("#status");
if (!status) throw new Error("找不到页面状态节点 #status");

const assetManager = new CCAssetManager();
const uuid = "hero-uuid";
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
      `资源对象: ${firstAsset.data.name}`,
      `首次请求前有缓存: ${cachedBeforeFirstRequest}`,
      `再次请求前有缓存: ${cachedBeforeSecondRequest}`,
      `两次请求是同一对象: ${firstAsset === secondAsset}`,
    ].join("\n");
  });
});
