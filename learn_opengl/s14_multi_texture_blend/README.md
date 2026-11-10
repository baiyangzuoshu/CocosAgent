# 第 14 课：多纹理单元与 shader 组合

把两张不同的纹理绑定到两个纹理单元，在同一个片段着色器中采样，再用 `mix` 按比例组合颜色。左右键调节比例，数字键可以直接查看 A、B 或 50% 混合结果。

## 学完后你能

- 区分纹理对象、纹理单元和 `sampler2D` uniform。
- 把两张纹理分别绑定到 `GL_TEXTURE0` 和 `GL_TEXTURE1`，并把对应单元编号传给 sampler uniform。
- 说明片段着色器如何采样两张纹理并按混合因子组合结果。
- 区分 shader 中颜色组合与 framebuffer 的 alpha blending。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s14_multi_texture_blend
```

- `Left` / `Right`：每次减少 / 增加 10% 的 B 纹理混合比例。
- `1`：只看纹理 A；`2`：只看纹理 B；`3`：恢复到各占一半。
- `Esc`：关闭窗口。

窗口标题显示当前比例。程序使用两张自动生成的 8×8 不透明 RGBA 图案，不需要外部图片。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。同一个方形矩形使用一套 UV 坐标；冷色棋盘纹理和暖色斜纹纹理分别绑定到不同的纹理单元。两个纹理都固定使用 `GL_NEAREST` 和 `GL_CLAMP_TO_EDGE`，避免把过滤、寻址或 mipmap 的变化混进本课。

### 纹理对象、单元与 sampler

纹理对象保存图像及其纹理参数。纹理单元是绘制时可供着色器采样的绑定槽。代码显式激活两个单元并绑定纹理对象：

```cpp
glActiveTexture(GL_TEXTURE0);
glBindTexture(GL_TEXTURE_2D, textureA);
glActiveTexture(GL_TEXTURE1);
glBindTexture(GL_TEXTURE_2D, textureB);
```

shader 中的 `sampler2D` uniform 记录要读取哪个纹理单元：

```cpp
glUniform1i(textureALocation, 0); // uTextureA 读取纹理单元 0
glUniform1i(textureBLocation, 1); // uTextureB 读取纹理单元 1
```

传给 sampler 的 `0`、`1` 是纹理单元编号，分别对应 `GL_TEXTURE0`、`GL_TEXTURE1`；它们不是纹理对象 ID，也不是 `GL_TEXTURE0` 这类枚举值。每次调用 `glBindTexture` 时，OpenGL 会把纹理绑定到当前激活单元的对应目标上。

### 在一个 shader 中组合两次采样

片段着色器用同一组 UV 采样两张纹理，再把颜色线性插值：

```glsl
vec4 colorA = texture(uTextureA, textureCoord);
vec4 colorB = texture(uTextureB, textureCoord);
fragmentColor = mix(colorA, colorB, uMixFactor);
```

对每个颜色通道，`mix(A, B, t)` 等价于 `A * (1 - t) + B * t`。`t = 0` 显示 A，`t = 1` 显示 B，`t = 0.5` 取两者的中间值。按键只改变传给 shader 的 `uMixFactor`，不重传纹理像素，也不改纹理绑定。

这里的混合发生在片段着色器内部，输出颜色直接写进颜色缓冲。两张图案都不透明，本例没有启用 OpenGL blending，也没有讨论透明物体排序；framebuffer 的 alpha blending 是第 15 课的主题。

## 动手观察

1. 按 `1`、`2` 对比两张输入纹理，再按 `3` 看两者的颜色如何组合。
2. 连续按 `Right`，观察纹理 B 的权重增加；按 `Left` 返回纹理 A。
3. 暂时把 shader 的 `mix` 改成只输出 `colorA` 或 `colorB`，确认两次采样分别对应正确的纹理单元。
4. 把两处 `glUniform1i` 的单元编号交换，观察 sampler 从另一个绑定槽读取的结果。

## 检查理解

- 为什么 `glUniform1i(uTextureA, 0)` 传的是 0，而不是 `GL_TEXTURE0` 或 `textureA` 的对象 ID？
- 若绑定纹理 A 后再次激活单元 0 并绑定纹理 B，`uTextureA` 会采样哪一个对象？
- `mix` 的混合因子改变了什么？为什么这和修改 OpenGL blending 状态不同？
- 如果两个 sampler uniform 都设为单元 0，shader 会分别采样哪两个纹理对象？

## 对照引擎源码

- Cocos2d-x 4.0 [`ProgramState.h`](../../engine/cocos2d-x-4/cocos/renderer/backend/ProgramState.h) 的 `setTexture` 接收 uniform location、slot 和纹理对象；[`CCPass.cpp`](../../engine/cocos2d-x-4/cocos/renderer/CCPass.cpp) 把纹理 slot 传给 `ProgramState`；OpenGL 后端 [`TextureGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/TextureGL.cpp) 的 `Texture2DGL::apply(index)` 用 `GL_TEXTURE0 + index` 激活对应单元并绑定纹理。
- Creator 3.8.7 [`descriptor-set.ts`](../../engine/3.8.7engine/cocos/gfx/base/descriptor-set.ts) 的 `bindTexture` 将纹理放入指定 descriptor binding；[`webgl2-descriptor-set.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-descriptor-set.ts) 的 `update` 将纹理视图和 sampler 写入 GPU descriptor；[`webgl2-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts) 根据 shader sampler 对应的 texture unit 激活单元、绑定纹理，并绑定 sampler。

本例是桌面 OpenGL 3.3 的直接绑定写法。Cocos Creator 3.8.7 先通过 GFX descriptor set 描述纹理与 sampler，再由 WebGL2 后端结合 shader sampler 的 texture unit 执行绑定；两层 API 的调用形式不同，但最终都要让 sampler 关联到可用的纹理和采样状态。
