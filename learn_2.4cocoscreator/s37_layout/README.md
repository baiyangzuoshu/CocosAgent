# 第 37 课：Layout 水平排布

**本课问题：** 动态添加子节点后，谁把它们按顺序排好，布局何时生效？

## 观察结果

三个宽度为 64、80、96 的子节点放入水平 Layout，间距 12、左右边距 16。容器宽度为 296，子节点中心位置为 [-100, -16, 84]。添加宽度 72 的第四项后，Layout 先标脏；在 AFTER_UPDATE 排版前读取仍是旧位置，更新后容器宽度变为 380，位置变为 [-142, -58, 42, 138]。

## 源码位置

- [CCLayout.js 的事件接线](../../engine/2.4.15engine/cocos2d/core/components/CCLayout.js#L444)：监听 AFTER_UPDATE、子节点增删和尺寸变化。
- [水平布局计算](../../engine/2.4.15engine/cocos2d/core/components/CCLayout.js#L941)：计算容器宽度并排列子节点。
- [updateLayout](../../engine/2.4.15engine/cocos2d/core/components/CCLayout.js#L991)：仅在布局标脏且有活动子节点时更新。

本课代码：[CCNode](src/cocos2d/core/CCNode.ts)、[CCDirector](src/cocos2d/core/CCDirector.ts)、[CCLayout](src/cocos2d/core/components/CCLayout.ts)、[入口](src/main.ts)。

## 简化范围

只实现水平排列、容器宽度随子项变化、左/右边距和间距。省略网格、垂直方向、子项拉伸、缩放参与、完整 Node 事件系统和场景遍历。页面图示是本课算法的示意，不是 Creator 引擎渲染。

## 运行

需要 Deno 和 Node.js 22.13 或更新版本。在本目录执行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。

## 本课必须保留的机制

- 子节点增删会标记 Layout 脏；水平位置在 `AFTER_UPDATE` 阶段按容器宽度、间距和边距重算。

## 最小观察宿主

- 页面布局图显示子节点顺序；添加子项后观察下一次布局更新。

## 模型化简化与 Creator Runtime 边界

- 仅保留水平排列算法模型，不实现完整场景遍历、事件系统、垂直或网格布局。
