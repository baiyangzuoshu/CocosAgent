# 第 9 课：纹理请求与缓存

**目标：** 看清 4.0 的 Director 如何提供 TextureCache，并复用同一路径的纹理。

## 本课增量

调用入口是 `Director::getInstance()->getTextureCache()`。`TextureCache::addImage()` 先解析完整路径并查 `_textures`；未命中时由 `Image` 读取图片、`Texture2D` 创建纹理并登记。本例保留前课组件更新，再请求同一图片两次。

## 源码位置

- `engine/cocos2d-x-4/cocos/base/CCDirector.h`：Director 提供 TextureCache。
- `engine/cocos2d-x-4/cocos/renderer/CCTextureCache.cpp:381-418`：解析路径、查缓存并创建纹理。
- `engine/cocos2d-x-4/cocos/platform/CCFileUtils.cpp:805-850`：按搜索路径解析完整文件名。

## 简化

路径解析固定加上 `Resources/`；`Image` 只保留文件名，不读取或解码图片，也不创建 GPU 纹理。缓存用 `unique_ptr` 表达持有关系，省略引擎的 `Ref` 计数和平台路径规则。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp -o /tmp/cocos2d-x-s09
/tmp/cocos2d-x-s09
~~~

输出中 `decode Resources/hero.png` 只出现一次，最后显示 `same texture: true`。

同主题课程：[Creator 2.4.15](../../learn_2.4cocoscreator/s09_asset_loading_cache/README.md)、[Creator 3.8.7](../../learn_3.8cocoscreator/s09_asset_loading_cache/README.md)；历史版本：[Cocos2d-x 1.x](../../learn_cocos2d-1x/s09_texture_cache/README.md)、[2.x](../../learn_cocos2d-2x/s09_texture_cache/README.md)、[3.x](../../learn_cocos2d-3x/s09_texture_cache/README.md)。
