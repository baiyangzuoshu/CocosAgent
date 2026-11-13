# 第 89 课：Web 构建产物地图

**本课目标：** 打开已有的 Web 构建目录，能说清浏览器入口、引擎、启动设置、Bundle 配置和资源文件分别是什么。

## 先记住整条线

Creator 工程里的源资源不会原样直接交给浏览器。编辑器先导入资源并生成运行时数据，再由构建流程把这些数据放进 Web 输出目录。本课只研究“输出里有什么、运行时会读什么”，不研究编辑器怎样生成它们。

~~~text
index.html
  → 启动脚本 + 引擎脚本
  → 启动设置（首场景、Bundle）
  → Bundle config（资源索引）
  → import 文件（序列化数据）和 native 文件（贴图等数据）
~~~

## 从本工程认文件

打开仓库里的 2.4NewProject/build/web-mobile/，对照下面的角色表：

| 文件 | 先把它理解成 | 本次样例 |
| --- | --- | --- |
| index.html | 浏览器打开的网页入口 | index.html |
| main.*.js | 项目启动代码 | main.975ec.js |
| cocos2d-js-min.*.js | Creator 2.4 Web 引擎代码 | cocos2d-js-min.7038f.js |
| src/settings.*.js | 启动设置，含首场景和 Bundle 版本 | src/settings.f161e.js |
| assets/main/config.*.json | main Bundle 的索引表 | config.a9f01.json |
| assets/main/import/...json | 场景等资源的序列化数据 | 05dd1dc0e.29693.json |
| assets/main/native/...png | 贴图等原生资源文件 | HelloWorld 贴图 |
| assets/BundleMain/... | 自定义 Bundle 的索引和资源 | label.prefab |

**Bundle** 可以先理解为一组资源的发布单元。main 是默认项目资源，internal 是引擎内置资源，BundleMain 是本样例的自定义资源组。每个 Bundle 的 config 告诉运行时资源 UUID、pack 和文件版本在哪里。

**import 和 native 的区别：** import 放引擎需要解析的导入数据；native 放由专门解析器读取的原始或平台资源。它们是两种文件类别，不代表“游戏资源”和“非游戏资源”。

## 跟着一个场景走

1. 在 src/settings.f161e.js 找 launchScene，确认入口场景是 db://assets/Scene/helloworld.fire。
2. 在同一文件找 bundleVers，记录 main 的版本 a9f01。
3. 用这个版本找到 assets/main/config.a9f01.json。这里是索引，不是场景本身。
4. config 中 scenes 把场景名映射到 uuids 数组位置；packs 再说明这些资源归哪个合并包。
5. 最后才到 assets/main/import/...json 找序列化数据；贴图数据则可能另在 native 目录。

本课的页面输出是按真实文件整理出的清单。它不会自动读取构建目录，因此哈希变化时要重新核对文件名。

代码也分成两层：`src/example-build.ts` 保存从构建目录摘出的样例文件清单，`src/cocos2d/core/asset-manager/BundleOutputMap.ts` 负责归类这些文件，`src/main.ts` 负责显示结果。先看样例，再看分类器，就能区分“数据来自哪里”和“代码怎样处理数据”。

## 对照引擎源码

- engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js：loadBundle 负责请求并创建 Bundle。
- engine/2.4.15engine/cocos2d/core/asset-manager/bundle.js：Bundle.loadScene 把场景名交给 assetManager.loadAny。
- engine/2.4.15engine/cocos2d/core/asset-manager/config.js：Config 把 config 中的数组和表整理成 UUID、场景、pack 等查找索引。

注意：引擎快照有运行时 AssetManager，但没有完整 Creator Editor Builder。这里能解释“运行时怎么使用输出”，不能据此复原“编辑器怎么生成输出”。

## 运行和检查

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，先逐行看页面上的角色，再在 Web 工程目录里找相同文件。

## 本课完成标准

你能用自己的话区分启动设置、Bundle config、import 数据、native 文件。下一课从源文件的 .meta 开始，解释这些索引里的 UUID 从哪里来。
