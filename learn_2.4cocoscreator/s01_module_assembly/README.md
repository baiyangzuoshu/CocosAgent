# 第 1 课：模块装配

**目标：** 看清引擎入口如何先建立共享的 cc，再加载模块。

## 本课增量

src/index.ts 创建 window.cc 和 cc.internal，再按顺序加载 core/predefine.ts。predefine.ts 当前只加载 CCMacro.ts；该模块把 RAD、DEG 注册到 cc.macro。

~~~text
src/index.ts
  → src/cocos2d/core/predefine.ts
    → src/cocos2d/core/platform/CCMacro.ts
~~~

## 源码对照

- engine/2.4.15engine/index.js：创建全局 cc、cc.internal，再加载核心预定义模块。
- engine/2.4.15engine/cocos2d/core/predefine.js：按顺序加载引擎模块。
- engine/2.4.15engine/cocos2d/core/platform/CCMacro.js：向 cc.macro 注册常量。

## 观察结果

页面显示“cc 模块已装配”以及 RAD 数值。先创建共享命名空间，再加载模块；模块通过导入副作用完成注册。这里只保留两个常量作为示例，其余宏和未涉及模块暂不加入。
