# 第 9 课：纹理请求与缓存

**目标：** 看清 2.x 如何解析文件名，并用完整路径复用 `CCTexture2D`。

## 本课增量

`CCTextureCache::addImage()` 先由 `CCFileUtils::fullPathForFilename()` 解析路径，再用完整路径查询缓存。首次请求创建并登记纹理；同一路径的后续请求复用它。本例保留前课的组件更新，并追加两次纹理请求。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/textures/CCTextureCache.cpp:394-418`：路径解析和缓存查询。
- `engine/cocos2d-x-2/cocos2dx/platform/CCFileUtils.cpp:597-620`：搜索路径解析及路径缓存。
- `engine/cocos2d-x-2/cocos2dx/textures/CCTextureCache.h`：`CCTextureCache` 接口。

## 简化

路径解析固定加上 `Resources/`；不读取图片字节、不解码、不创建 GPU 纹理。缓存用 `unique_ptr` 表达持有关系，省略引擎对象池和引用计数。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/support/component/CCComponent.cpp src/cocos2dx/support/component/CCComponentContainer.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp -o /tmp/cocos2d-2x-s09
/tmp/cocos2d-2x-s09
~~~

输出中 `decode Resources/hero.png` 只出现一次，最后显示 `same texture: true`。
