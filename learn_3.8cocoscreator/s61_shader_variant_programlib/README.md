# 第 61 课：Creator 3.8 ProgramLib 与 WebGL2 Shader

**本课问题：** 3.8 如何把宏变体变成 GFX Shader，并延迟到需要 GPU 对象时才创建 WebGL 程序？

## 本版渲染路径

ProgramLib.define() 处理 Shader 模板；getGFXShader() 合并管线宏、形成变体缓存键，填充 ShaderInfo 的阶段源码和活动属性，再调用 Device.createShader()。WebGL2 Device 创建 WebGL2Shader 并保存 ShaderInfo；读取 gpuShader 时才调用命令函数编译、链接和反射 Uniform。

## 源码位置

- [program-lib.ts](../../engine/3.8.7engine/cocos/render-scene/core/program-lib.ts)：define() 和 getGFXShader() 建立模板、宏变体与 Shader 缓存。
- [program-utils.ts](../../engine/3.8.7engine/cocos/render-scene/core/program-utils.ts)：genHandles()、getSize() 从 Uniform block 和 sampler 描述生成资源句柄与尺寸。
- [webgl2-device.ts](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-device.ts)：createShader() 创建并初始化 WebGL2 Shader 对象。
- [webgl2-shader.ts](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-shader.ts)：initialize() 保存 ShaderInfo；gpuShader getter 按需请求 GPU 程序。
- [webgl2-commands.ts](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts)：WebGL2CmdFuncCreateShader() 编译阶段源码、链接程序并收集资源信息。

## 独立代码与简化

src/cocos/ 按 3.8 的 ProgramLib、Device、Shader 和 WebGL 命令职责拆分。示例在浏览器实际编译 WebGL2 Shader，演示宏变体缓存与惰性 GPU 程序创建；省略 PipelineLayout、DescriptorSet 和完整 Uniform block 句柄布局，也不提交绘制命令。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000/。首次访问变体时创建 Shader wrapper，读取 gpuShader 后才编译链接；不同宏生成不同程序，再请求同一宏时命中缓存。
