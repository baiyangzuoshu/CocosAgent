# 第 58 课：4.0 Sprite 几何与 backend 命令输入

**本课问题：** 4.0 的 Sprite 如何更新 quad 属性，再把三角形数据和 backend 纹理交给 Renderer？

## 本版路径

setTextureRect 触发 updatePoly，更新 quad 的顶点和 UV；颜色变化写入四角。Sprite::draw 把 triangles、backend texture、BlendFunc 和变换交给 TrianglesCommand。4.0 命令使用 backend Texture 与 pipeline blend 描述；本课只观察命令输入，不展开后端缓冲和 draw 提交。

## 源码位置

- engine/cocos2d-x-4/cocos/2d/CCSprite.cpp:475-522：纹理区域更新 quad 并生成 polygon 数据。
- engine/cocos2d-x-4/cocos/2d/CCSprite.cpp:1531-1555：颜色写入 quad 四角，并在批处理路径更新 atlas。
- engine/cocos2d-x-4/cocos/2d/CCSprite.cpp:1098-1127：命令接收三角形数据并加入 Renderer。
- engine/cocos2d-x-4/cocos/renderer/CCTrianglesCommand.cpp:38-70：保存三角形、backend texture 与 blend/pipeline 状态。
- 前置课：第 57 课：相机过滤与 backend 命令顺序（../s57_node_render_order/README.md）。

## 独立代码与简化

示例保留 4.0 的 backend Texture 指针和 BlendDescriptor 命令输入；以日志表示命令，不创建图形设备、不上传顶点缓冲。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/renderer/CCRenderer.cpp src/cocos/renderer/CCTrianglesCommand.cpp -o /tmp/cocos2d-x-s58
/tmp/cocos2d-x-s58
~~~

输出可看到 quad 四角、三角形数量、backend 纹理和 blend 描述。
