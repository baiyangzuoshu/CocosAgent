# Creator 2.4.15 源码学习

从这里开始。课程以 Web 浏览器运行时为目标，用 TypeScript 逐课搭建一份精简实现，重点理解引擎的模块边界和调用顺序。

## 学习方式

1. 按编号打开一课，先看本课要解决的问题。
2. 对照课内列出的 Creator 2.4.15 源码位置。
3. 直接运行本课目录里的独立代码。
4. 按本课说明观察命令行或页面结果。

每课目录都保存一份完整、可运行的代码快照。后一课从前一课增加一层功能，因此既能单独运行，也能看到架构如何逐步长成。代码目录尽量对应 Creator 源码职责，只裁掉当前 Web 路径无关的代码。

## 课程目录

- [课程大纲](课程大纲.md)：完整阶段规划与源码文件索引。
- [运行准备：浏览器宿主](web_host/README.md)：提供后续浏览器运行课使用的最小宿主，不计课次。
- [第 0 课：`.meta` 元数据分析](s00_meta_analysis/README.md)：从贴图元数据追踪主资源和 SpriteFrame UUID。
- [第 1 课：模块装配](s01_module_assembly/README.md)：创建 cc 命名空间并注册第一个模块。
- [第 2 课：游戏启动](s02_game_startup/README.md)：调用 cc.game.run() 并观察引擎启动事件。
- [第 3 课：Director 初始化与主循环](s03_director_loop/README.md)：由 requestAnimationFrame 驱动 Director。
- [第 4 课：节点与场景树](s04_node_scene_tree/README.md)：建立节点父子关系并遍历场景树。
- [第 5 课：本地位置与世界位置](s05_local_world_transform/README.md)：累加父链平移，得到节点的世界位置。
- [第 6 课：场景加载后的节点激活](s06_node_activation/README.md)：由 NodeActivator 递归更新节点的层级激活状态。
- [第 7 课：组件挂载与生命周期](s07_component_lifecycle/README.md)：观察 `onLoad`、`onEnable`、`onDisable` 的调用顺序。
- [第 8 课：组件每帧调度](s08_component_scheduling/README.md)：观察 `start`、`update`、`lateUpdate` 的阶段顺序。
- [第 9 课：资源请求与缓存](s09_asset_loading_cache/README.md)：同一 UUID 的重复请求复用 Asset 对象。
- [第 10 课：Director 到渲染流程](s10_render_entry/README.md)：活动场景进入 RenderFlow。
- [第 11 课：渲染脏标记与世界变换](s11_render_flags_dirty/README.md)：只重算发生变化的节点。
- [第 12 课：四边形几何与 WebGL 提交](s12_sprite_quad/README.md)：把节点组装成 4 个顶点、6 个索引并绘制。
- [第 13 课：SpriteFrame 连接贴图](s13_sprite_frame_texture/README.md)：从图集矩形算出 UV，再由 WebGL 采样贴图。
- [第 14 课：浏览器输入坐标](s14_browser_input/README.md)
- [第 15 课：节点命中与事件回调](s15_node_event_hit/README.md)
- [第 16 课：节点事件传播](s16_event_propagation/README.md)
- [第 17 课：Prefab 实例化](s17_prefab_instantiation/README.md)
- [第 18 课：组件实例与资源共享](s18_component_asset_sharing/README.md)
- [第 19 课：实例挂载与组件生命周期](s19_instance_lifecycle/README.md)：观察 Prefab 加入活动场景后触发组件回调。
- [第 20 课：节点移除与重新挂载](s20_node_detachment/README.md)
- [第 21 课：延迟销毁与 onDestroy](s21_deferred_destruction/README.md)
- [第 22 课：NodePool 节点复用](s22_node_pool/README.md)
- [第 23 课：NodePool 回收与复用回调](s23_node_pool_callbacks/README.md)
- [第 24 课：对象池未命中与 Prefab 兜底](s24_pool_miss_fallback/README.md)
- [第 25 课：对象池容量上限与超额销毁](s25_pool_capacity_limit/README.md)
- [第 26 课：对象池预热与首次复用](s26_pool_prewarm/README.md)
- [第 27 课：对象池低水位补充](s27_pool_low_water_refill/README.md)
- [第 28 课：对象池 clear 的销毁时机](s28_pool_clear_timing/README.md)
- [第 29 课：外部引用与对象池清理](s29_pool_external_owner/README.md)

## 代码结构

~~~text
learn_2.4cocoscreator/
├── README.md                  # 课程入口
├── 课程大纲.md
├── web_host/                  # 浏览器宿主准备，不计课次
├── s00_meta_analysis/         # 独立的第 0 课，分析 .meta 和 UUID
│   ├── README.md
│   ├── deno.json
│   ├── samples/
│   └── src/
├── s01_module_assembly/       # 独立的第 1 课工程，含前课功能
│   ├── README.md
│   ├── deno.json
│   ├── index.html
│   └── src/cocos2d/core/      # 镜像 Creator 的模块职责
├── s02_game_startup/          # 独立的第 2 课工程，含前课功能
│   ├── README.md
│   ├── deno.json
│   ├── index.html
│   └── src/cocos2d/core/
├── s03_director_loop/         # 独立的第 3 课工程，含前课功能
    ├── README.md
    ├── deno.json
    ├── index.html
    └── src/cocos2d/core/
├── s04_node_scene_tree/       # 独立的第 4 课工程，含前课功能
    ├── README.md
    ├── deno.json
    ├── index.html
    └── src/cocos2d/core/
├── s05_local_world_transform/ # 独立的第 5 课工程，含前课功能
    ├── README.md
    ├── deno.json
    ├── index.html
    └── src/cocos2d/core/
├── s06_node_activation/       # 独立的第 6 课工程，含前课功能
├── s07_component_lifecycle/   # 独立的第 7 课工程，含前课功能
├── s08_component_scheduling/  # 独立的第 8 课工程，含前课功能
├── s09_asset_loading_cache/   # 独立的第 9 课工程，含前课功能
├── s10_render_entry/          # 独立的第 10 课工程，含前课功能
├── s11_render_flags_dirty/    # 独立的第 11 课工程，含前课功能
├── s12_sprite_quad/           # 独立的第 12 课工程，含前课功能
│   ├── README.md
│   ├── deno.json
│   ├── index.html
│   ├── assets/
│   └── src/cocos2d/core/
├── s13_sprite_frame_texture/  # 独立的第 13 课工程，含前课功能
│   ├── README.md
│   ├── deno.json
│   ├── index.html
│   ├── assets/
│   └── src/cocos2d/core/
├── s14_browser_input/         # 浏览器输入与画布坐标
├── s15_node_event_hit/        # 节点命中与事件回调
├── s16_event_propagation/     # 捕获、目标和冒泡
├── s17_prefab_instantiation/ # Prefab 生成独立节点树
├── s18_component_asset_sharing/ # 组件独立、SpriteFrame 共享
├── s19_instance_lifecycle/     # 实例挂载与组件生命周期
├── s20_node_detachment/        # 节点移除与重新挂载
├── s21_deferred_destruction/ # 延迟销毁与 onDestroy
├── s22_node_pool/           # NodePool 节点复用
├── s23_node_pool_callbacks/ # NodePool 回收与复用回调
├── s24_pool_miss_fallback/  # 对象池未命中与 Prefab 兜底
├── s25_pool_capacity_limit/ # 对象池容量上限与超额销毁
├── s26_pool_prewarm/       # 对象池预热与首次复用
├── s27_pool_low_water_refill/ # 对象池低水位补充
├── s28_pool_clear_timing/  # 对象池 clear 的销毁时机
└── s29_pool_external_owner/ # 外部引用与对象池清理
~~~

## 运行

进入要学习的课程目录，按该课 README 中的命令运行。浏览器课有自己的 `deno.json`、`index.html` 和 `src/`；第 0 课是独立的元数据分析脚本。

课程讲义会列出对应的 Creator 源码路径，路径相对于仓库根目录。
