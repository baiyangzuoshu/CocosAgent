# 第 0 课：`.meta` 元数据分析

**目标：** 从贴图 `.meta` 的 `subMetas` 读取纹理立方体和面资源的 UUID。

## 本课增量

示例读取 3.8.7 内置 `default_skybox.png.meta` 的字段节选，逐层输出主贴图、纹理立方体子资源和一个立方体面。子资源 UUID 会带上 `@子 ID`；嵌套子资源继续追加 ID。

## 源码与样例位置

- `engine/3.8.7engine/editor/assets/default_skybox/default_skybox.png.meta:1-16`：主贴图及纹理立方体子资源身份。
- `engine/3.8.7engine/editor/assets/default_skybox/default_skybox.png.meta:32-46`：纹理立方体面子资源的 UUID。
- `engine/3.8.7engine/cocos/asset/asset-manager/config.ts:272-300`：运行时 Config 按路径查资源信息。
- `samples/default_skybox.png.meta.sample.json`：为便于阅读而缩短的字段节选。

## 简化

`.meta` 属于 Creator 编辑器导入工作流；浏览器运行时使用构建产物中的资源配置，不会读取这个文件。样例不是完整的 Creator `.meta`，不可直接导入工程。3.8 的资源与子资源 UUID 结构以本版本样例为准。

## 运行

~~~sh
deno task check
deno task analyze
~~~

输出主贴图 UUID、`@b47c0` 纹理立方体 UUID，以及 `@b47c0@74afd` 面资源 UUID。浏览器宿主准备见课程入口的“运行准备”。
