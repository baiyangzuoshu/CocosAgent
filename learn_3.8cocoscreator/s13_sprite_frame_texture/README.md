# 第 13 课：SpriteFrame 连接贴图

**目标：** 看清 SpriteFrame 如何把图集区域变成贴图采样所需的 UV。

## 本课增量

Asset 描述图集区域；Texture2D 加载浏览器图片；SpriteFrame 将像素矩形换成 UV。Sprite 组装器把位置和 UV 写入四个顶点，Batcher2D 绑定贴图并通过 WebGL shader 采样。示例只取 128×64 图集左侧 64×64 区域。

## 源码位置

- `engine/3.8.7engine/cocos/2d/components/sprite.ts:204-218,691-719`：SpriteFrame 属性变化后更新 Sprite 渲染数据。
- `engine/3.8.7engine/cocos/2d/assets/sprite-frame.ts:432-440,955-980`：SpriteFrame 保存贴图，并按贴图尺寸计算 UV。
- `engine/3.8.7engine/cocos/2d/assembler/sprite/simple.ts:52-65,98-135`：组装顶点数据并写入批次。
- `engine/3.8.7engine/cocos/2d/renderer/batcher-2d.ts:420-485`：Batcher2D 接收渲染数据并组织绘制批次。

## 简化

独立代码按源码职责拆分，只支持未旋转、未裁剪的单个矩形帧；省略动态合图、材质变体、相机裁剪和 GPU 资源释放。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。画面显示图集左侧的圆形角色；状态栏可读到资源连接和 UV。
