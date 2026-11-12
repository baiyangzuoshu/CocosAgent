# 第 81 课：Cocos2d-x 2.x（2.2.6）Runtime 与导出资源版本兼容

**本课问题：** 导出的 Spine 数据格式和版本如何与本版 Runtime 对接？

## 本版实现

解析器保存导出版本信息；单独比较导出器与本版 Runtime，不能把解析成功当作兼容证明。

## 源码位置

- [SkeletonJson.cpp](../../engine/cocos2d-x-2/extensions/spine/SkeletonJson.cpp)：重点查看 SkeletonJson_readSkeletonDataFile、SkeletonData.version。
- [SkeletonData.h](../../engine/cocos2d-x-2/extensions/spine/SkeletonData.h)：重点查看 SkeletonData.version、Atlas page。
- [Atlas.cpp](../../engine/cocos2d-x-2/extensions/spine/Atlas.cpp)：重点查看 Atlas_readAtlasFile、Atlas_dispose。

本阶段从 Runtime 与资源版本关系开始。

## 独立代码与简化

[src/extensions/spine/SpineStudy.h](<src/extensions/spine/SpineStudy.h>)、[src/extensions/spine/SpineStudy.cpp](<src/extensions/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例仅模拟该快照的 C Runtime 包装。源码没有 MeshAttachment / ClippingAttachment，也没有 AnimationState 时间线事件回调。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/spine/SpineStudy.cpp -o /tmp/cocos-x2-s81
/tmp/cocos-x2-s81
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
