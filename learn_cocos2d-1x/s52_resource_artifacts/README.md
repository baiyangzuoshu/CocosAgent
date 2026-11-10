# 第 52 课：资源处理与产物结构

**本课问题：** Cocos2d-x 1.x 怎样从平台资源根目录解析游戏资源？

## 观察结果

Linux 版本在 `AppDelegate` 中把资源根目录设为 `../Resources/`；场景仍只请求相对文件名 `HelloWorld.png`，`CCFileUtils` 再补上当前平台的资源根。资源是项目文件/平台数据目录，不经过 Creator 式 UUID 与导入索引。

## 源码位置

- [Linux 启动代码设置 `../Resources/`](../../engine/cocos2d-x-1/HelloWorld/Classes/AppDelegate.cpp#L61)；[场景按文件名读取图片](../../engine/cocos2d-x-1/HelloWorld/Classes/HelloWorldScene.cpp#L63)。
- [`CCFileUtils` 的 `setResourcePath` 接口](../../engine/cocos2d-x-1/cocos2dx/platform/CCFileUtils.h#L145)；[Marmalade 工程指定 `Resources` 数据目录](../../engine/cocos2d-x-1/HelloWorld/marmalade/HelloWorld.mkb#L3)。

独立代码：[资源根路径模型](src/resource/ResourceLayout.h) 和 [路径输出程序](src/main.cpp)。

## 简化范围

示例固定 Linux 相对路径，打印项目资源位置和运行时解析路径；不复制文件或生成平台包，也不代表其他平台使用同一路径。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp -o /tmp/cocos2d-1x-s52
/tmp/cocos2d-1x-s52
~~~
