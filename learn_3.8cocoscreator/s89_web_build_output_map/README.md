# 第 89 课：Web 构建产物地图

**本课目标：** 打开已有的 Web 构建目录，能说清浏览器入口、引擎、启动设置、Bundle 配置和资源文件分别是什么。

## 先记住整条线

Creator 工程里的源资源不会原样直接交给浏览器。编辑器先导入资源并生成运行时数据，再由构建流程把这些数据放进 Web 输出目录。本课只研究“输出里有什么、运行时会读什么”，不研究编辑器怎样生成它们。

~~~text
index.html
  → 启动脚本 + 引擎脚本
  → src/settings.json（首场景、项目 Bundle）
  → assets/main/config.json（资源索引）
  → import 文件（序列化数据）和 native 文件（贴图、网格等数据）
~~~

## 从本工程认文件

打开仓库里的 3.8NewProject/build/web-mobile/，对照下面的角色表：

| 文件 | 先把它理解成 | 本次样例 |
| --- | --- | --- |
| index.html | 浏览器打开的网页入口 | index.html |
| application.js、index.js | 应用启动和项目入口 | application.js、index.js |
| cocos-js/cc.js | Creator 3.8 Web 引擎模块 | cocos-js/cc.js |
| src/settings.json | 首场景、预加载 Bundle、平台和渲染设置 | src/settings.json |
| assets/main/config.json | main Bundle 的资源索引 | config.json |
| assets/main/import/...json | 场景等资源的序列化数据 | 0693a7d89.json |
| assets/main/native/...bin | Mesh 等原生资源文件 | soldier Mesh 子资源 |
| assets/internal/config.json | 引擎内置资源的索引 | internal/config.json |

**Bundle** 可以先理解为一组资源的发布单元。main 是项目资源，internal 是引擎内置资源。当前构建没有输出 BundleMain，所以本课只分析实际存在的两个 Bundle。

**import 和 native 的区别：** import 放引擎需要解析的导入数据；native 放由专门解析器读取的原始或平台资源。Mesh 的二进制数据属于 native，即使它来自 FBX 源文件。

## 跟着一个场景走

1. 在 src/settings.json 找 launchScene，确认首场景是 db://assets/scene/main.scene。
2. 查看 assets.projectBundles 和 assets.preloadBundles，理解“项目里有哪些 Bundle”和“启动时预加载哪些 Bundle”不是一回事。
3. 打开 assets/main/config.json。它用 scenes、uuids、packs 等表让运行时找到资源。
4. 用场景 UUID 找到 pack 文件 assets/main/import/06/0693a7d89.json。
5. Prefab 引用的 Mesh 子资源数据在 assets/main/native/...bin。

本课的页面输出是按真实文件整理出的清单。它不会自动读取构建目录，因此改过资源或构建设置后要重新核对文件名。

代码也分成两层：`src/example-build.ts` 保存从构建目录摘出的样例文件清单，`src/cocos/asset/asset-manager/BundleOutputMap.ts` 负责归类这些文件，`src/main.ts` 负责显示结果。先看样例，再看分类器，就能区分“数据来自哪里”和“代码怎样处理数据”。

## 对照引擎源码

- engine/3.8.7engine/cocos/asset/asset-manager/asset-manager.ts：loadBundle 请求配置并创建 Bundle。
- engine/3.8.7engine/cocos/asset/asset-manager/bundle.ts：Bundle.loadScene 把场景名交给 AssetManager。
- engine/3.8.7engine/cocos/asset/asset-manager/config.ts：Config 整理 UUID、场景、pack 和版本索引。

样例由 Creator 3.8.8 构建，仓库引擎快照是 3.8.7。两者的版本差异要记在结论里。引擎快照没有完整 Creator Editor Builder，所以本课解释运行时如何使用产物，不推断编辑器的完整打包步骤。

## 运行和检查

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，先逐行看页面上的角色，再在 Web 工程目录里找相同文件。

## 本课完成标准

你能区分启动设置、Bundle config、import 数据、native 文件，并解释当前输出为何只有 main 和 internal。下一课从源文件的 .meta 开始，解释这些索引里的 UUID 从哪里来。
