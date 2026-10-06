# 对象与场景 skill 验证记录

本记录对应 `cocos2-object-lifecycle-trace` 与 `cocos3-object-lifecycle-trace`。验证环境是 Creator 2.4.15 与 3.8.7 的编辑器浏览器预览。临时本机代理在预览宿主加载前注入内存预制体实验；原始[2.x](../traces/2.4.15-object-scene.jsonl)和[3.x](../traces/3.8.7-object-scene.jsonl)记录保留事件顺序与状态，工程和引擎源码没有修改。

## 官网手册校准（2026-10-02）

| 核对项 | 结果 |
| --- | --- |
| 激活条件和生命周期 | [2.4 节点接口](https://docs.cocos.com/creator/2.4/manual/zh/scripting/basic-node-api.html)、[3.8 节点接口](https://docs.cocos.com/creator/3.8/manual/zh/scripting/basic-node-api.html)均区分 `active` 与 `activeInHierarchy`；两版[生命周期说明（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/life-cycle-callbacks.html)、[生命周期说明（3.8）](https://docs.cocos.com/creator/3.8/manual/zh/scripting/life-cycle-callbacks.html)与实测的首次入场 `onLoad → onEnable`、关闭时 `onDisable` 相符。多组件顺序和每帧调度不在本轮实测范围。 |
| 克隆与编辑器实例 | 两版[创建节点（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/create-destroy.html)、[创建节点（3.8）](https://docs.cocos.com/creator/3.8/manual/zh/scripting/create-destroy.html)都要求把克隆接入场景。[2.4 预制资源](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/prefab.html)默认手动同步；[3.8 预制件](https://docs.cocos.com/creator/3.8/manual/zh/asset/prefab.html)有实例覆盖和嵌套。本次内存预制体实验不验证编辑器保存、还原或同步。 |
| 销毁与有效性 | 两版创建销毁手册概括为 `destroy()` 后在当前帧逻辑更新结束时移除。源码及原始记录进一步显示调用返回时普通有效性检查仍为真、严格检查为假，稍后普通检查也变为假。skill 已要求分别判断待销毁与已清理，不把这次时序推广到未测平台。 |
| 版本专属陷阱 | [2.4 节点接口](https://docs.cocos.com/creator/2.4/manual/zh/scripting/basic-node-api.html)要求在保留事件/action 时对 `removeFromParent` 传 `false`；[3.8 节点接口](https://docs.cocos.com/creator/3.8/manual/zh/scripting/basic-node-api.html)使用无参数形式。3.8 Prefab 手册中的 `Persistent` 是预留选项，跨场景常驻另用[场景 API](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scene-managing.html)。两份 skill 已分别限定。 |

本次校准重读官网手册、既有源码和原始记录，没有重新运行预览或完成编辑器 prefab 工作流实验。原四个案例的运行结论保留，并补上官方公开行为和适用范围。

| 案例 | 按 skill 定位的路径 | 验证结果 |
| --- | --- | --- |
| 2.x：`instantiate(prefab)` 后组件没有 `onLoad` | 从 `Prefab._instantiate` 查到克隆根无父节点，再查 `BaseNode.addComponent` 只在活动层级激活组件。 | 实测克隆 `active=true`、`activeInHierarchy=false`；挂组件后无回调，设 `parent=scene` 才出现 `onLoad → onEnable`。 |
| 2.x：调用 `destroy()` 后 `isValid()` 仍为真 | `BaseNode.destroy` 使节点立即失活，`CCObject.destroy` 标记待销毁，`_deferredDestroy` 稍后调用组件的 `onDestroy`。 | 实测 `destroy()` 当下先 `onDisable`，普通 `isValid=true`、严格 `isValid=false`；随后 `onDestroy`，普通 `isValid=false`。 |
| 3.x：`main.scene` 只见少量 Node，为什么预览有完整 3D 场景 | 从 `Scene._load` 进入预制体展开，结合 `PrefabInstance`、属性覆盖和资产 UUID 解释树结构。 | 示例场景 JSON 直接记录 5 个 Node，却还有 3 个预制体实例，分别关联 islands、soldier、grassGoup 资源；skill 不把顶层记录数当成运行时节点数。 |
| 3.x：场景根上添加组件或重设父节点后状态异常 | 分别检查 `Scene.addComponent` 与 `Node.setParent(value, keepWorldTransform)`，再沿层级激活链判断回调。 | `Scene.addComponent()` 源码明确抛错；最小预览实验把组件挂在子节点，接入场景后同步触发 `onLoad → onEnable`。保留世界变换路径本轮仅由源码确认，未作为实测结论。 |

本轮对核心链路已有一次浏览器预览测量；构建产物、原生平台、编辑器 prefab 保存/覆盖流程及组件每帧执行顺序需要后续阶段各自验证。引擎目录未安装 `node_modules`，因此没有运行原仓库测试；本轮验证依赖实际预览实验与源码交叉检查。

本次校准后，七份相关文档的本地相对链接与手册版本链接已检查；两份 skill 的 YAML frontmatter 通过 Ruby 标准 YAML 解析器。安装 PyYAML 6.0.3 后，又使用当前 Homebrew Python 3.13 分别运行 `skill-creator/scripts/quick_validate.py`，两份 skill 均输出 `Skill is valid!`。
