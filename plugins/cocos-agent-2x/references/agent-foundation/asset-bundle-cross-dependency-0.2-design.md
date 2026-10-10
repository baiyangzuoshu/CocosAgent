# CocosAgent 跨 Asset Bundle 依赖合同 0.2

**状态：Host/MCP 清单、构建校验和 2.4 预览运行时调度已实现；自动化测试通过。Creator CLI 实机尝试以 `BUILD_FAILED` / exit code 1 结束且未生成输出目录，因此尚无新构建或浏览器端到端验收。** 范围限定为 Creator 2.4.15、同一份本地 `web-mobile` 构建中的 PNG → Texture → SpriteFrame 与 `.fire` 场景引用。其它资源类型、远端/CDN、多版本 Bundle、小游戏、JSB、原生和 Creator 3.8 需要各自补验。

本合同把 `content-release` 0.1 的 release 内 `dependsOn` 扩展为跨交付依赖边。0.1 现有字段含义不变，不得把 release 内依赖解释成 Bundle 外部依赖。

## 1. 名词与责任

| 概念 | 合同含义 |
| --- | --- |
| Owner delivery | 唯一实际打包资源导入数据、native 文件和 Bundle config 资源项的交付。一个目标构建中的 UUID 只能有一个 owner。 |
| Consumer delivery | 包含场景或资源序列化引用的交付。Consumer 保存 UUID 引用和指向 owner 的 redirect，不重复拥有同一资源。 |
| Static edge | 场景、Prefab、材质等序列化内容对资源 UUID 的引用，由导入 `.meta` 和构建配置共同核验。 |
| Runtime lease | 活动场景、组件、动态生成节点或 `addRef()` 持有资源的运行时使用关系。2.4 引擎的静态引用计数不能覆盖所有动态引用，CocosAgent 需要记录自己发起的动态持有。 |

同一共享资源的“唯一所有者”和“多个使用者”必须分开表达。Owner 决定资源字节和元数据从哪里交付；Consumer 与 Runtime lease 说明谁会读取或继续使用它。

## 2. 合同载体

`content.bundle.dependencies.plan` 接收显式 PNG `assetSources`、`contractId` 和目标 `buildId`，Host 从 PNG `.meta`、Bundle 文件夹 `.meta` 与引用 SpriteFrame UUID 的 `.fire` 文件推导以下清单，不让调用方手写 owner/consumer。UUID 在清单中使用完整 UUID；构建校验器再与压缩 UUID 索引对账。

```json
{
  "schema": "cocos.asset-bundle-dependency",
  "version": "0.2",
  "creatorVersion": "2.4.15",
  "platform": "web-mobile",
  "buildId": "shared-dependency-20261010-01",
  "deliveries": [
    { "id": "owner-resources", "kind": "builtin-bundle", "bundleName": "resources", "role": "owner" },
    { "id": "consumer-smoke", "kind": "bundle", "bundleName": "cocos-agent-smoke", "role": "consumer", "dependsOn": ["owner-resources"] },
    { "id": "consumer-sidecar", "kind": "bundle", "bundleName": "cocos-agent-sidecar", "role": "consumer", "dependsOn": ["owner-resources"] }
  ],
  "assets": [
    {
      "uuid": "0683b14a-8790-4ecd-9ee5-4b83163e34ff",
      "type": "cc.SpriteFrame",
      "ownerDeliveryId": "owner-resources",
      "meta": { "rawTextureUuid": "bf8602ca-5561-4eb5-8c63-9653d4c32a4f" },
      "dependsOn": ["bf8602ca-5561-4eb5-8c63-9653d4c32a4f"]
    },
    {
      "uuid": "bf8602ca-5561-4eb5-8c63-9653d4c32a4f",
      "type": "cc.Texture2D",
      "ownerDeliveryId": "owner-resources",
      "dependsOn": []
    }
  ],
  "references": [
    { "consumerDeliveryId": "consumer-smoke", "sceneUuid": "d86b9b2f-5d52-43b3-b2c7-5e345f9960e4", "assetUuid": "0683b14a-8790-4ecd-9ee5-4b83163e34ff" },
    { "consumerDeliveryId": "consumer-sidecar", "sceneUuid": "53751717-051c-4b3d-abe7-19bfc2b3990a", "assetUuid": "0683b14a-8790-4ecd-9ee5-4b83163e34ff" }
  ],
  "loadOrder": ["owner-resources", "consumer-smoke", "consumer-sidecar"],
  "unloadOrder": ["consumer-sidecar", "consumer-smoke", "owner-resources"]
}
```

`buildId`, platform, delivery names, config hashes, asset UUIDs and dependency edges are one build identity. A runtime consumer must not be paired with an owner from another build unless a later contract explicitly verifies compatible versioned delivery.

`content.bundle.dependencies.stage` 将合同以不可变记录写入项目 `.cocos-agent/bundle-dependencies/<contractId>.json`；`get` 会重新读取字节、元数据和场景引用并比较指纹。Bundle 交付名来自本地 Bundle 文件夹 `.meta`；`assets/resources/` 推导为 owner `resources`；场景路径推导 consumer delivery。当前扫描静态引用限于 `.fire` 场景和 SpriteFrame；不声称覆盖 Prefab、材质或其他序列化资源类型。

## 3. 构建验收

传入 `dependencyContractId` 时，构建只有满足以下检查才可标记为 `verified`：

1. **源元数据链**：PNG `.meta.uuid` 等于 Texture UUID；对应 `subMetas[*].uuid` 等于 SpriteFrame UUID；`rawTextureUuid` 等于该 Texture UUID。Scene/Prefab 序列化数据中出现的 UUID 必须存在于清单引用边中。
2. **唯一 owner**：目标平台的所有 Bundle config 中，SpriteFrame 与 Texture UUID 各只在声明的 owner 中作为本地资源项出现；owner 条目不带 `redirect`。记录 owner `config.json` 哈希、资源路径/索引和所需 native 文件。
3. **Consumer redirect**：Consumer config 的 `deps` 包含 owner Bundle 名；SpriteFrame 的压缩 UUID 在 `uuids` 中有索引，`redirect` 的 UUID 索引准确命中该项，redirect 的 dependency 索引解析为 owner 名。Consumer 的 Scene UUID 及资源引用也必须与清单吻合。
4. **依赖闭包**：SpriteFrame 到 Texture 的 UUID 边与 `.meta.rawTextureUuid` 一致；清单中每个传递依赖都存在且只有一个 owner。构建产物中的压缩 UUID 必须解码回清单完整 UUID，不能仅比较资源路径或文件名。
5. **身份一致**：写入回执包含 Creator 版本、平台、buildId、owner/consumer 配置哈希和检查结果。缺失 owner 条目、重复 owner、UUID 冲突、meta 链断裂或 redirect 指向错误 Bundle 时，返回具体校验错误并停止预览。

## 4. 加载顺序与错误恢复

清单按依赖图拓扑排序，供 2.4 运行时适配器在 Agent 动态内容应用前执行：先 `loadBundle(owner)`，等待回调成功，并用 `getBundle(ownerName)` 确认实例名，再确认当前 Consumer Bundle 已加载，最后才加载候选动态资源。Host 已验证的构建合同随运行时 `apply` 消息发送；owner/consumer 不在图中、Bundle 回调身份不符或加载失败都会拒绝候选，保留当前帧。静态场景 UUID 与候选动态资源 UUID 分别记录，候选不必就是合同中的静态资源。该调度运行在当前场景启动之后，不会重排当前场景的首次加载，也不拦截游戏代码自行调用的任意 `loadBundle/loadScene`；要保证首次场景加载顺序，调用方仍须在加载场景前按同一清单预载 owner。

Creator 2.4.15 在 owner Bundle 缺席时对 Consumer 的 UUID 请求返回 `Please load bundle resources first`。Agent 应将这次尝试记为 `OWNER_NOT_LOADED`，加载已验证的 owner 后，再重试同一只读加载请求。失败场景不得进入运行，也不得假报成功。若加载 owner 后仍报错，停止并回报 config/UUID/redirect 对账结果。

## 5. 卸载与共享资源保留

释放必须按依赖逆序处理，Consumer 先于 owner：

1. 阻止该 Consumer 的新加载，并停止或切离使用它的场景；清除动态节点/组件对共享资源的引用，释放 Agent 自己登记的 `addRef()` lease。
2. 调用 Consumer 的 Bundle 清理；读取活动场景 UUID、SpriteFrame/Texture 对象有效性、`refCount` 与 Asset Cache。共享资源须仍有效，其他活动 Consumer 也须继续可用。
3. 只有无活动 Consumer、无在途加载、无 Agent runtime lease，且场景/序列化依赖已对账后，才允许清理 owner 的资源。对共享资源优先使用经过引用检查的 `releaseUnusedAssets()`；释放后读回 Asset Cache、`valid`、`refCount` 和依赖资源状态。
4. 最后移除 owner Bundle 对象。若仍有引用或读回不一致，返回 `OWNER_RELEASE_DEFERRED` 或 `needs-review`，保留资源与 owner；不得通过 `releaseAll()` 强制越过活动引用。

当前运行时实现会追踪 CocosAgent 自己持有的动态 lease，并在 `EVENT_AFTER_SCENE_LAUNCH` 后重试被延迟的清理。Consumer 场景仍活动、另一条 Agent lease 仍共用 owner、或 `releaseUnusedAssets()` 后合同 UUID 仍在缓存时，回执为 `OWNER_RELEASE_DEFERRED`；资源与 Bundle 保留。owner Bundle config 对象目前保留，不做自动 `removeBundle`，以免影响未由合同枚举的其他资源使用者。运行时只用非强制 `releaseUnusedAssets()`，不会主动调用 `releaseAll()`。

这里有三项 2.4.15 特别规则：

- `Bundle.releaseAll()` 对当前 Bundle 自有资源根调用强制释放；因此 owner 的 `releaseAll()` 不能充当“检查是否仍有人使用”的安全卸载。引擎的 `releaseUnusedAssets()` 使用非强制释放检查；本次活动场景仍持有共享 Frame 时，它保留了 Frame 与 Texture。
- `removeBundle()` 只移除 Bundle config 对象缓存，不释放已经加载的资源。它适合在资源清理完成后移除 Bundle；提前移除 owner 会让当前对象继续可用，却使后续 redirect 加载失败。
- 当 Scene 的 `autoReleaseAssets=false`，场景退出会降低该场景依赖的引用计数，但不自动安排这些资源释放；资源可以在 `refCount=0` 时仍留在 Asset Cache。显式清理仍需由 owner 发起，并再次核对引用和依赖。
- 运行时调度须记录源 `.fire.meta` 设置、`.fire` 序列化 Scene 字段和已加载 Scene runtime 值；发生差异时，以 runtime 值驱动场景释放判断并保留三者证据。当前夹具的三者读数为 `false`、`true`、`false`。

`refCount` 是引擎静态引用信息的一部分，并不覆盖所有动态 JavaScript 持有。因而“refCount 为零”不能替代 Agent 对活动 Scene、节点/组件、加载任务和自身 lease 的对账。

建议回执至少包括 `ownerLoaded`、`consumerLoaded`、`loadOrder`、`activeConsumers`、`activeSceneUuid`、`autoReleaseAssets`、`assetUuid`、`ownerBundle`、`redirectTarget`、`refCountBefore/After`、`assetCachedBefore/After`、`assetValidBefore/After`、`decision` 和 `reason`。成功卸载只在预期 UUID 确实从缓存消失、依赖没有悬空引用后确认。

## 6. 2.4.15 Web-Mobile 证据

[共享依赖边界轨迹](traces/cocos-agent-shared-bundle-boundaries-2.4-web.json)由 Creator 2.4.15 的实际 Web-Mobile 构建在隔离 Chrome 中采集：

- owner `resources` 未加载且 Frame/Texture 不在 Asset Cache 时，consumer Bundle config 加载成功；consumer 按共享 SpriteFrame UUID 加载失败，错误为 `Please load bundle resources first`。先加载 owner 后，同一 UUID 和 `BundleSharedA` 场景均可加载。
- 两个已加载 Scene 的运行时 `autoReleaseAssets` 都是 `false`，探针未修改该值。切到 Sidecar 后 Frame/Texture 均 `refCount=1` 且有效。释放并移除两个 Consumer Bundle 时，Sidecar 仍在运行，共享资源有效并保持缓存。
- 活动 Consumer 期间调用 owner `releaseUnusedAssets()` 后，共享 Frame/Texture 仍为 `refCount=1`、有效且缓存存在；移除 owner Bundle 对象也没有破坏当前画面。切出所有测试场景后 Frame `refCount=0` 仍在缓存，随后 owner `releaseUnusedAssets()` 使 Frame 和 Texture 均从 Asset Cache 消失。
- 扫描该构建的 5 份 Bundle config 后，Frame 与 Texture 各只有 `resources` 一个未重定向 owner；`cocos-agent-smoke`、`cocos-agent-sidecar` 和 `main` 的 Frame UUID 都 redirect 到 `resources`。owner config 同时包含 Frame 和 Texture 的资源索引。源 PNG `.meta.rawTextureUuid`、完整 UUID、场景 UUID 与 redirect 均在轨迹中留档。
- 两份源 `.fire.meta` 的 `autoReleaseAssets=false`，原始 `.fire` 序列化 Scene 字段却为 `true`；本次构建加载后的 Scene runtime 值为 `false`，探针未改写。运行时决策以已加载 Scene 的实际属性为准；不要单独用 `.fire` JSON 字段或 `.meta` 值替代运行时读回。画面截图见[autoReleaseAssets=false 检查点](traces/visual/cocos-agent-shared-boundary-auto-release-false.png)。

探针可复跑：

```bash
node docs/agent-foundation/probes/cocos-bundle-shared-boundaries-2.4.mjs
```

既有[共享依赖双向卸载轨迹](traces/cocos-agent-shared-bundle-dependency-2.4-web.json)补充了两个 Consumer 的先后顺序、共享对象身份、可见性和引用快照。本轮新增证据只覆盖本地 Web-Mobile PNG SpriteFrame 场景，不证明远端 Bundle 版本交叉组合、原生内存回收或其它类型资源。

## 7. 实现状态与边界

已实现的 MCP 工具为 `cocos_2x_bundle_dependencies_plan/stage/get`；`content.build.plan/execute/reconcile` 接受可选合同 ID 与预期指纹；构建记录和 verified artifact 持久化合同、owner/consumer config 哈希及逐 UUID 检查。`content.preview.start` 重新校验合同和构建证据，并随运行时消息传递合同。2.4 runtime core 在动态内容替换时 acquire/release lease，按场景 UUID 识别 consumer、owner-first 加载，并对活动 Scene 与 Asset Cache 做非强制延迟释放检查。

自动化覆盖合同推导与漂移检测、owner/consumer/UUID/redirect 校验、buildId 绑定、MCP/JSONL 路由以及 2.4 runtime adapter/core 的 load order 和 lease defer。用已有 `shared-dependency-20261010-01` Web-Mobile 产物做只读校验时，owner `resources`、两个 Bundle consumers、`main` scene、Frame→Texture import 边和 redirect 均通过。该旧包不是新 Host 生成的绑定合同产物。新的隔离构建 `cross-bundle-web-1010` 使用现有选中 release 和合同 `cross-bundle-20261010-01` 尝试执行，Creator launcher 返回 exit code 1，未生成输出目录；本地失败回执保存在项目忽略目录 `.cocos-agent/content-builds/cross-bundle-web-1010.json`。因此没有真实预览验收，模拟和旧包离线读回不能算新合同实机证据。

重跑：`node --test tools/cocos-agent-bridge/content-bundle-dependencies.test.js tools/cocos-agent-bridge/content-build.test.js tools/cocos-agent-bridge/runtime/content-swap-core.test.js tools/cocos-agent-bridge/runtime/cocos-agent-content-runtime.test.js`，以及 `cd tools/cocos-agent-bridge/mcp && npm test`。`content-release` 0.1 的同 release `dependsOn` 字段语义保持不变。资源类型扩展、Prefab 静态引用、Bundle 物理卸载/缓存回收策略和 Creator 3.8 仍待独立实现或验收。
