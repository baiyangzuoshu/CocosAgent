# 第 37 课：Layout 水平排布

**本课问题：** 动态添加子节点后，谁把它们按顺序排好，布局何时生效？

## 观察结果

三个宽度为 64、80、96 的 UI 子节点放入水平 Layout，间距 12、左右边距 16。容器宽度为 296，子节点中心位置为 [-100, -16, 84]。添加宽度 72 的第四项后，Layout 标脏；AFTER_UPDATE 前仍是旧布局，更新后容器宽度为 380，位置变为 [-142, -58, 42, 138]。

## 源码位置

- [Layout 的 AFTER_UPDATE 与子节点事件](../../engine/3.8.7engine/cocos/ui/layout.ts#L737)：监听尺寸、锚点、变换、增删和活动状态变化。
- [updateLayout](../../engine/3.8.7engine/cocos/ui/layout.ts#L702)：脏标记或 force 为 true 时执行。
- [水平布局计算](../../engine/3.8.7engine/cocos/ui/layout.ts#L1110)：按 UITransform 尺寸计算容器宽度并定位子节点。

本课代码：[Node](src/cocos/scene-graph/node.ts)、[UITransform](src/cocos/2d/framework/ui-transform.ts)、[Layout](src/cocos/ui/layout.ts)、[Director](src/cocos/game/director.ts)、[入口](src/main.ts)。

## 简化范围

只实现水平排列、容器宽度随子项变化、左右边距和间距。省略网格、垂直方向、子项拉伸、缩放参与、完整事件系统和场景遍历。页面图示是本课算法的示意，不是 Creator 引擎渲染。

## 运行

需要 Deno 和 Node.js 22.13 或更新版本。在本目录执行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
