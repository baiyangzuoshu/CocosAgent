# 第 52 课：资源处理与产物结构

**本课问题：** Cocos2d-x 2.x 怎样按搜索路径找到资源文件？

## 观察结果

模板把资源放在 `Resources/`；游戏按相对文件名创建 Sprite。`CCFileUtils::fullPathForFilename` 按搜索路径和分辨率目录尝试文件，并缓存命中的完整路径。Marmalade 工程还显式把 `../Resources/` 声明为数据目录。

## 源码位置

- [HelloCpp 按相对文件名加载图片](../../engine/cocos2d-x-2/template/multi-platform-cpp/Classes/HelloWorldScene.cpp#L68)；[Marmalade 指定数据目录](../../engine/cocos2d-x-2/template/multi-platform-cpp/proj.marmalade/HelloCpp.mkb#L4)。
- [`fullPathForFilename` 查找并缓存命中路径](../../engine/cocos2d-x-2/cocos2dx/platform/CCFileUtils.cpp#L621)；[`setSearchPaths` 设置查找顺序](../../engine/cocos2d-x-2/cocos2dx/platform/CCFileUtils.cpp#L696)。

独立代码：[搜索路径模型](src/resource/ResourceSearch.h) 和 [查找示例](src/main.cpp)。

## 简化范围

示例只模拟搜索路径优先级，不调用引擎 `FileUtils`、不读磁盘，也不生成平台包；真实查找还会结合分辨率顺序与平台默认根目录。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp -o /tmp/cocos2d-2x-s52
/tmp/cocos2d-2x-s52
~~~
