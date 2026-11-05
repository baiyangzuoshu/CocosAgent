# 第 9 课：纹理请求与缓存

**目标：** 看清 1.x 怎样把图片路径映射到可复用的 `CCTexture2D`。

## 本课增量

`CCTextureCache::addImage()` 先移除可能的 `-HD` 后缀，再解析完整路径并查缓存。首次请求创建纹理并登记；再次请求同一路径直接返回缓存对象。本例沿用前课的 Node 定时回调，并打印两次请求是否拿到同一纹理。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/textures/CCTextureCache.cpp:313-369`：路径解析、缓存查询和未命中后的纹理创建。
- `engine/cocos2d-x-1/cocos2dx/platform/CCFileUtils.cpp:349-353`：`fullPathFromRelativePath` 入口。
- `engine/cocos2d-x-1/cocos2dx/include/CCTextureCache.h`：共享纹理缓存接口。

## 简化

路径解析固定加上 `Resources/`；不读取图片字节、不解码、不创建 GPU 纹理。缓存用 `unique_ptr` 表达持有关系，省略引擎对象池和引用计数。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp -o /tmp/cocos2d-1x-s09
/tmp/cocos2d-1x-s09
~~~

输出中 `decode Resources/hero.png` 只出现一次，最后显示 `same texture: true`。
