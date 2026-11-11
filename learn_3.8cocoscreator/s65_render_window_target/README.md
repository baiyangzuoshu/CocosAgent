# 第 65 课：Creator 3.8 RenderTexture 与 RenderWindow

**本课问题：** 3.8 怎样把 Camera 接到可供材质采样的离屏目标？

## 本版渲染路径

RenderTexture 初始化时由 Root 创建 RenderWindow；RenderWindow 持有颜色纹理、RenderPass 和 Framebuffer。CameraComponent.targetTexture 将内部 Camera 切换到该 Window 并设置固定尺寸。默认管线按 camera.window.framebuffer 绘制；材质可从 RenderTexture 取得 GFX Texture。

## 源码位置

- [render-texture.ts](../../engine/3.8.7engine/cocos/asset/assets/render-texture.ts)：创建和持有 RenderWindow，并从 window.framebuffer 取得颜色纹理。
- [render-window.ts](../../engine/3.8.7engine/cocos/render-scene/core/render-window.ts)：创建颜色/深度附件、RenderPass 和 GFX Framebuffer。
- [camera-component.ts](../../engine/3.8.7engine/cocos/misc/camera-component.ts)：targetTexture setter 切换目标窗口并设置相机尺寸。
- [forward-stage.ts](../../engine/3.8.7engine/cocos/rendering/forward/forward-stage.ts)：通过 camera.window.framebuffer 开始相机绘制。
- [framebuffer.ts](../../engine/3.8.7engine/cocos/gfx/base/framebuffer.ts)：GFX Framebuffer 抽象。

## 独立代码与简化

src/cocos/ 分别保留 RenderTexture、RenderWindow、CameraComponent 和默认管线入口。示例以日志表示 Window/Framebuffer 的关联与纹理读取，不创建真实 GFX 对象。

## 运行

~~~
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000/，观察 Camera 改用 RenderTexture.window 后，Sprite 从该 Window 的颜色附件取纹理。
