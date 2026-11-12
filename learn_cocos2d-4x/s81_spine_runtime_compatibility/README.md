# 第 81 课：Cocos2d-x 4.0 Runtime 与导出资源版本兼容

**本课问题：** 导出的 Spine 数据格式和版本如何与本版 Runtime 对接？

## 本版实现

解析器保存导出版本信息；单独比较导出器与本版 Runtime，不能把解析成功当作兼容证明。

## 源码位置

- [SkeletonJson.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/SkeletonJson.cpp)：重点查看 SkeletonJson::readSkeletonDataFile、SkeletonData::_version。
- [SkeletonBinary.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/SkeletonBinary.cpp)：重点查看 SkeletonBinary::readSkeletonDataFile。
- [SkeletonData.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/SkeletonData.cpp)：重点查看 SkeletonData version field。

本阶段从 Runtime 与资源版本关系开始。

## 独立代码与简化

[src/cocos/editor-support/spine/SpineStudy.h](<src/cocos/editor-support/spine/SpineStudy.h>)、[src/cocos/editor-support/spine/SpineStudy.cpp](<src/cocos/editor-support/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例是独立 C++ 职责模型，不链接 Spine C++ Runtime 或真实 Renderer；v3 与 v4 Runtime / batch 分别记录。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/editor-support/spine/SpineStudy.cpp -o /tmp/cocos-x4-s81
/tmp/cocos-x4-s81
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
