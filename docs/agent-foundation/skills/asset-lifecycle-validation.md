# 阶段 4 资源生命周期 skill 试用与验证

对象：`cocos2-asset-lifecycle-trace`、`cocos3-asset-lifecycle-trace`，基于本地 2.4.15 / 3.8.7 源码和两套示例。2026-10-02 已核对对应官网 2.4 / 3.8 手册专题页。下表为文件与调用链试用；后文另列 Chrome 浏览器预览的实际观测。

| 试用任务 | skill 应追踪的证据 | 当前判断 |
| --- | --- | --- |
| 2.x 正常案例：场景使用 `HelloWorld.png`，为什么场景文本搜不到贴图主 UUID？ | `helloworld.fire:431-432` 指向 SpriteFrame `31bc...`；`HelloWorld.png.meta` 中子资源 `rawTextureUuid` 指向主资源 `6aa...`；`depend-util.js` 与 `load.js::loadDepends` 构造运行时依赖。 | 文件级身份追踪通过；预览已看到 SpriteFrame 与主贴图均在缓存且各有正引用。 |
| 2.x 易混淆案例：`autoReleaseAssets=false` 时切场景是否仍销毁旧资源？ | `helloworld.fire:51`、`releaseManager.js::_autoRelease` 将此标志传给 `Asset.decRef`；`CCAsset.js::decRef(false)` 递减引用但不安排释放；其他显式释放或未记录引用仍需单独判断。 | 内存 Scene 隔离实验及后续 Director 真正切换内存 Scene 均验证该分支；不能据此断言所有旧资源一直驻留。 |
| 3.x 正常案例：`soldier.FBX` 的 Mesh 找不到独立源文件？ | `soldier.FBX.meta` 的 `subMetas` 为 Mesh/Skeleton/Animation 分配 `主UUID@子ID`；`main.scene` 中直接引用预制体 UUID，预制体再关联模型资源。 | 通过文件级身份追踪；要求从子资源返回导入源，不把 `@` UUID 当损坏的 UUID。具体加载时序待测。 |
| 3.x 易混淆案例：移除 Bundle 后仍看到 Asset 缓存，是否是泄漏？ | `asset-manager.ts::removeBundle` 只 `_destroy` 并移除 `bundles` 项，源码注释明确不自动释放其 Asset；`release-manager.ts` 管对象释放。 | 通过源码区分 Bundle 配置与 Asset 缓存；是否泄漏还需看真实引用持有者。 |

## 浏览器预览试用

- [3.8.7 原始转录](../traces/3.8.7-asset-lifecycle.jsonl)：示例当前场景未直接引用的 `hdcSky.prefab` 起初不在对象缓存中。`preloadAny` 返回 8 个请求项后仍不在缓存；`loadAny` 返回 Prefab，缓存身份相同、直接依赖 2 项，回调净 `refCount=0`。显式 `addRef` 后调用非强制 `releaseUnusedAssets` 仍保留；`decRef` 后立即缓存仍在，约 200ms 后对象已销毁并从缓存移除。
- [2.4.15 原始转录](../traces/2.4.15-asset-lifecycle.jsonl)：场景 `helloworld` 预加载返回 4 个请求项而场景 UUID 不在 `assets`；`loadAny` 返回 SceneAsset 仍不入对象缓存，也没有切换活动场景。再次加载缓存中的 SpriteFrame，回调前后净 `refCount` 都为 2；这个数字受到刚加载的第二份 SceneAsset 影响。内存构造的独立 `cc.Asset` 在 `refCount=1` 时通过非强制尝试仍有效，`decRef` 后约 200ms 才从缓存移除并失效。

追加复核：两版都以**内存 Scene + 独立内存 Asset**直接调用 `_autoRelease`。`autoReleaseAssets=false` 时引用降至 0，但约 150ms 后资源仍在缓存且有效；`true` 时引用归零并从缓存移除、对象失效。另一个独立内存 Asset 在 `refCount=1` 时非强制尝试仍有效，显式 `releaseAsset` 则在引用数仍为 1 时强制移除。3.x `main.scene` 的 `preloadAny/loadAny` 也返回 SceneAsset 且不入对象缓存，未切换活动场景。3.x `hdcSky.prefab` 冷缓存流程已重复得到相同结果；2.x SpriteFrame 在后续多次加载场景资源后净 `refCount=3`，说明观测时点的数字不能视为固定常量。

2026-10-03 追加的 2.x Director 实测：实际调用 `runSceneImmediate` 切换内存 Scene，旧 Scene 的独立资源在 `autoReleaseAssets=false` 时降至零引用但仍缓存，`true` 时移出缓存并失效。常驻节点携带的独立资源跨场景保持引用，移除常驻身份并再次切换后释放。首次内存 Scene 探针没有给新 Scene 登记依赖记录，导致后续仍残留 1 个引用；补齐 `dependUtil._depends` 后才形成正常的 `persistDeps` 转移。预览已重载回 `helloworld`。这些是内存对象的受控实验，尚未覆盖真实磁盘场景复杂依赖。

随后在 3.x 重复 Director 路径实验：`autoReleaseAssets=false` 时旧场景资源降至零引用但仍缓存；`true` 时释放并失效。常驻节点跨场景保持资源引用，移除常驻身份并再次切换后释放。预览已重载，活动场景 UUID 恢复为 `main.scene`。两版的完整 Director 内存探针均已完成；这些结果不代表磁盘场景复杂依赖或其他平台。

两份 skill 目前作为**候选草案**保存在 `docs/`，不宣称已在未来 agent 环境安装。没有对正在显示的场景贴图或预制体做强制释放实验。

## 磁盘、导入与 Mac 分面复核

2026-10-03 又分别用两版真实磁盘场景核对文件引用与运行时依赖表，并由各自 Creator 导入 `resources/stage4-probe.json`。两个浏览器预览均从未缓存状态加载对应 `JsonAsset`，数据版本与项目相符，回调净引用为 0；只增减探针自己的引用后资源移出对象缓存并失效。[2.x 原始记录](../traces/2.4.15-disk-import-validation.jsonl)和[3.x 原始记录](../traces/3.8.7-disk-import-validation.jsonl)分别包含 UUID、导入产物路径、场景依赖计数与加载结果。由此，2.x 普通磁盘资源冷缓存加载已有实测。

两版还各自完成 Mac 构建、编译/Make 与原生窗口启动，确认 JSON 被打包且原有场景可见。追加的[2.x](../traces/2.4.15-mac-native-asset-lifecycle.jsonl)和[3.x](../traces/3.8.7-mac-native-asset-lifecycle.jsonl)原生进程日志均包含冷缓存加载回调、缓存对象身份、`refCount=0→1→0`、非强制释放保留及随后对象失效。打点只覆盖不属于活动场景的最小 JSON；其他资源类型与原生平台仍需另测。准确范围列于[阶段 4 验证矩阵](../asset-validation-matrix.md)。

随后两套对应编辑器分别创建并保存 `stage4-empty` 场景，Chrome 预览与 Mac 原生包中均经 `director.loadScene` 真正从旧磁盘场景切入它。[2.x Chrome](../traces/2.4.15-disk-scene-switch.jsonl)和[3.x Chrome](../traces/3.8.7-disk-scene-switch.jsonl)跟踪旧场景独有的 SpriteFrame 与 `soldier.prefab`；[2.x Mac](../traces/2.4.15-mac-native-disk-scene-switch.jsonl)和[3.x Mac](../traces/3.8.7-mac-native-disk-scene-switch.jsonl)在各自打包进程中重复了两种开关分支。所有面中，默认 `autoReleaseAssets=false` 后引用归零但 350ms 仍缓存有效；分别独立启动并在**运行时旧 Scene 对象**上设 `true` 后，切换回调时仍缓存有效，350ms 采样时已移出缓存并失效。两版源场景文件仍为 `false`；未验证保存开关后的构建行为或 Android/iOS。两份 skill 已加入旧场景静态依赖、排除新场景依赖、三时点记录与 Mac 原生复测说明。

已将两版各五个资源管线核心文件（AssetManager、load、release manager、Bundle、depend util）与各自已安装 Creator 2.4.15/3.8.7 内的同名源文件逐一 SHA-256 比对，十项均一致。3.8 仓库的 `tests/asset-manager/finalizer.test.ts` 含场景自动释放、常驻节点及受保护资源的既有测试；本机 `3.8.7engine/node_modules/.bin/jest` 缺失，定向执行未启动，故没有记录通过结果。两份新 skill 的 `quick_validate.py` 均输出 `Skill is valid!`，本地相对链接已检查。
