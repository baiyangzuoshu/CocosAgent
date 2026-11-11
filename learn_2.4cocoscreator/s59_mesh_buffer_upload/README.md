# 第 59 课：Creator 2.4 MeshBuffer 上传

**本课问题：** RenderData 中的顶点和索引，何时从 CPU 数组进入 WebGL Buffer？

## 本版渲染路径

RenderFlow/Batcher 把 assembler 产生的几何数据写进 MeshBuffer。MeshBuffer.uploadData 在数据脏且非空时，分别生成 Float32Array 和 Uint16Array，再调用 VertexBuffer.update、IndexBuffer.update。首次扩容用 gl.bufferData，已有空间用 gl.bufferSubData。InputAssembler 保存顶点缓冲、索引缓冲和图元类型，为后续 draw 描述输入。

## 源码位置

- [render-data.js](../../engine/2.4.15engine/cocos2d/core/renderer/webgl/render-data.js)：RenderData 中的顶点与索引数组。
- [mesh-buffer.js](../../engine/2.4.15engine/cocos2d/core/renderer/webgl/mesh-buffer.js)：uploadData、requestStatic、缓冲偏移和扩容。
- [vertex-buffer.js](../../engine/2.4.15engine/cocos2d/renderer/gfx/vertex-buffer.js)：update 将数组上传到 WebGL ARRAY_BUFFER。
- [index-buffer.js](../../engine/2.4.15engine/cocos2d/renderer/gfx/index-buffer.js)：update 将索引上传到 ELEMENT_ARRAY_BUFFER。
- [input-assembler.js](../../engine/2.4.15engine/cocos2d/renderer/core/input-assembler.js)：将 VB、IB 与 primitiveType 组成绘制输入。

## 独立代码与简化

src/cocos2d/ 只保留 RenderData → MeshBuffer → VB/IB → InputAssembler 的 WebGL 路径。浏览器实际创建 WebGL Buffer 并上传四个二维顶点与六个索引；为聚焦上传，不创建 Shader、不调用 drawElements。顶点格式简化为 XY 两个浮点数。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000/。日志能看到首次 bufferData 上传，以及 InputAssembler 持有的三角形索引数量。
