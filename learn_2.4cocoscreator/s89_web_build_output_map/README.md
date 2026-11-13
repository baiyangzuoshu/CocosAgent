# 第 89 课：Web 构建产物地图

**本课问题：** Creator 2.4.15 的 Web 构建把页面、引擎、Bundle 配置和资源放在哪里？

## 本课内容

用 `2.4NewProject/build/web-mobile/` 中现有的 Web 输出整理目录职责：页面入口、引擎脚本、启动设置、Bundle 配置、导入数据和原生文件。示例列出的文件名来自当前样例构建，不代表所有项目都会生成相同哈希或相同目录。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js:677-706`：加载 Bundle 配置。
- `engine/2.4.15engine/cocos2d/core/asset-manager/bundle.js`：Bundle 读取路径和场景配置。
- `engine/2.4.15engine/cocos2d/core/asset-manager/config.js:53-68`：把构建配置载入运行时 Config。
- 完整编辑器 Builder 不在本地源码快照中；这里的目录清单来自已生成文件。

## 独立代码

- [输出角色模型](src/cocos2d/core/asset-manager/BundleOutputMap.ts)
- [浏览器页面](src/main.ts)

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://127.0.0.1:8000> 查看输出地图。页面是课程自己的观察模型，不会读取或修改 Creator 构建目录。
