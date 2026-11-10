# 第 37 课：CCMenu 水平排列菜单项

**本课问题：** 1.x 如何把一组菜单项排成水平行？

## 观察结果

本版本没有通用 UI Layout 组件。CCMenu 提供菜单项排列方法：三项宽度 64、80、96，间距参数为 12 时，中心位置是 [-100, -16, 84]。添加宽度 72 的菜单项后，应用再次调用排列方法，得到 [-142, -58, 42, 138]。

## 源码位置

- [CCMenu.h 的水平排列接口](../../engine/cocos2d-x-1/cocos2dx/include/CCMenu.h#L88)：提供默认间距和指定间距两种方法。
- [CCMenu::alignItemsHorizontallyWithPadding](../../engine/cocos2d-x-1/cocos2dx/menu_nodes/CCMenu.cpp#L279)：累计子项宽度和间距，再以菜单原点为中心设置各项位置。

本版本的菜单项排布是一次性计算，不会监听尺寸或增删事件；变化后要再次调用方法。本课没有补造通用 Layout API。

本课代码：[CCNode 与菜单项](src/cocos2dx/include/CCNode.h)、[CCMenu](src/cocos2dx/include/CCMenu.h)、[排列实现](src/cocos2dx/menu_nodes/CCMenu.cpp)、[入口](src/main.cpp)。

## 简化范围

只保留菜单项尺寸、位置与水平排列。省略菜单触摸、场景树和渲染；用独立 CCMenuItem 对象演示源码中的坐标计算。

## 运行

在本目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/menu_nodes/CCMenu.cpp -o /tmp/cocos2d-1x-s37
/tmp/cocos2d-1x-s37
~~~
