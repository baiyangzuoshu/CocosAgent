# 第 93 课：Bundle 索引与文件 URL

**本课问题：** Creator 3.8 如何把 UUID 索引、pack 和 native 文件转成地址？

## 本课内容

使用当前主 Bundle 配置中的 scene 索引和 pack 表，得到实际序列化包地址；再把 FBX Mesh 的压缩 UUID 解码成子资源 UUID，并定位实际 `.bin` 文件。3.8 的 UUID 解码会保留 `@子 ID` 后缀。

## 源码位置

- `engine/3.8.7engine/cocos/asset/asset-manager/config.ts:244-268`：Config 初始化索引与扩展名。
- `engine/3.8.7engine/cocos/asset/asset-manager/config.ts:272-328`：路径与场景查找。
- `engine/3.8.7engine/cocos/asset/asset-manager/url-transformer.ts:190-224`：选择 import/native 基址并组合 URL。
- `engine/3.8.7engine/cocos/core/utils/decode-uuid.ts`：解码 UUID 并保留子资源后缀。
- 实际文件位于 `3.8NewProject/build/web-mobile/assets/`；这里仅记录当前构建证据。

## 独立代码

- [UUID 解码](src/cocos/core/utils/decode-uuid.ts)
- [Bundle Config](src/cocos/asset/asset-manager/config.ts)
- [URL 转换](src/cocos/asset/asset-manager/url-transformer.ts)
- [浏览器运行入口](src/main.ts)

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

示例只读取所需的当前配置片段，不重建 Creator Bundle。
