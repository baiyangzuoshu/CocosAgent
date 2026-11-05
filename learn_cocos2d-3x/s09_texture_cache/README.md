# 第 9 课：纹理请求与缓存

**目标：** 看清 3.x 的 Director 如何提供 TextureCache，并复用同一路径的纹理。

## 本课增量

调用入口是 `Director::getInstance()->getTextureCache()`。`TextureCache::addImage()` 先解析完整路径并查 `_textures`；未命中时由 `Image` 读取图片、`Texture2D` 创建纹理并登记。本例保留前课组件更新，再请求同一图片两次。

## 源码位置

- `engine/cocos2d-x-3/cocos/base/CCDirector.h`：Director 提供 TextureCache。
- `engine/cocos2d-x-3/cocos/renderer/CCTextureCache.cpp:398-435`：解析路径、查缓存并创建纹理。
- `engine/cocos2d-x-3/cocos/platform/CCFileUtils.cpp:818-845`：按搜索路径解析完整文件名。

## 简化

路径解析固定加上 `Resources/`；`Image` 只保留文件名，不读取或解码图片，也不创建 GPU 纹理。缓存用 `unique_ptr` 表达持有关系，省略引擎的 `Ref` 计数和平台路径规则。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp -o /tmp/cocos2d-3x-s09
/tmp/cocos2d-3x-s09
~~~

输出中 `decode Resources/hero.png` 只出现一次，最后显示 `same texture: true`。
