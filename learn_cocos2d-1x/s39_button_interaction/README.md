# 第 39 课：CCMenuItem 命中、选中与激活

**本课问题：** 1.x 没有通用 UI Button 时，菜单项怎样命中并触发回调？

## 观察结果

`CCMenu` 在触摸开始时找出命中的启用项并选中它；移动出菜单项会取消选中。结束时只激活当前选中项，所以移出后释放不调用回调，完整点按才调用 `CCMenuItem` 的 selector。

## 源码位置

- [CCMenu::ccTouchBegan/Moved/Ended](../../engine/cocos2d-x-1/cocos2dx/menu_nodes/CCMenu.cpp#L166)：选择触摸项、移动时重新命中，结束时激活选中项。
- [CCMenu::itemForTouch](../../engine/cocos2d-x-1/cocos2dx/menu_nodes/CCMenu.cpp#L588)：检查可见、启用状态和矩形命中。
- [CCMenuItem 选中状态](../../engine/cocos2d-x-1/cocos2dx/menu_nodes/CCMenuItem.cpp#L73)：`selected` 与 `unselected`。
- [CCMenuItem::activate](../../engine/cocos2d-x-1/cocos2dx/menu_nodes/CCMenuItem.cpp#L100)：启用时调用 target/selector。

本课代码：[CCMenuItem](src/cocos2dx/include/CCMenuItem.h)、[菜单输入流程](src/cocos2dx/menu_nodes/CCMenu.cpp)、[菜单项激活](src/cocos2dx/menu_nodes/CCMenuItem.cpp)、[入口](src/main.cpp)。

## 简化范围

只保留菜单项矩形命中、选中状态和 selector 回调，不实现通用 Button。省略触摸分发器、节点变换、层级优先级、脚本桥接和菜单渲染。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/menu_nodes/CCMenu.cpp src/cocos2dx/menu_nodes/CCMenuItem.cpp -o /tmp/cocos2d-1x-s39
/tmp/cocos2d-1x-s39
~~~
