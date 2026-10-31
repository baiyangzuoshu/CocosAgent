# 第 1 课：模块装配

**目标：** 看清引擎入口如何先建立共享的 cc，再加载模块。

**src/index.ts** 创建 window.cc 和 cc.internal，然后按顺序加载 core/predefine.ts。core/predefine.ts 目前只加载 CCMacro.ts；该模块把 RAD、DEG 注册到 cc.macro。后续课程会按 Creator 源码顺序逐步加入模块。

**关键点：** 先创建共享命名空间，再加载预定义模块；这里用动态导入保留源码 require 的先后顺序。预定义模块通过导入副作用向 cc 注册功能。

观察页面中的 “cc 模块已装配” 和 RAD 数值。入口按源码路径是：

~~~text
index.ts
  → cocos2d/core/predefine.ts
    → cocos2d/core/platform/CCMacro.ts
~~~

对应 Creator 2.4.15 源码：

- engine/2.4.15engine/index.js：创建全局 cc、cc.internal，再加载核心预定义模块。
- engine/2.4.15engine/cocos2d/core/predefine.js：按顺序 require 引擎模块。
- engine/2.4.15engine/cocos2d/core/platform/CCMacro.js：向 cc.macro 注册常量。

本课只保留两个常量作为模块副作用的示例，其余宏和未涉及模块暂不加入。
