# 第 60 课：3.x Material、Technique、Pass 与 RenderState

**本课问题：** 3.x 如何沿 Material → Technique → Pass 继承并应用绘制状态？

## 本版渲染路径

3.x 的 Material、Technique、Pass 都继承 `RenderState`，子对象保存父级关系。`Pass::bind()` 先应用 GLProgramState 与 Uniform，再调用 `RenderState::bind()`；后者收集层级中显式修改的状态，恢复未指定项，再按 Material → Technique → Pass 顺序应用。本例只模拟混合和深度状态。

## 源码位置

- [CCMaterial.h](../../engine/cocos2d-x-3/cocos/renderer/CCMaterial.h)：Material 继承 RenderState。
- [CCTechnique.h](../../engine/cocos2d-x-3/cocos/renderer/CCTechnique.h)：Technique 继承 RenderState 并持有 Pass。
- [CCPass.h](../../engine/cocos2d-x-3/cocos/renderer/CCPass.h)：Pass 继承 RenderState。
- [CCPass.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCPass.cpp)：`Pass::bind()` 应用 GLProgramState 后绑定 RenderState。
- [CCRenderState.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCRenderState.cpp)：收集覆盖位并按层级顺序应用 StateBlock。

## 独立代码与简化

`src/cocos/renderer/` 保留 3.x 的继承和父链关系；日志模拟 GL 状态应用。省略状态缓存、默认态恢复细节和真实 GLProgram；这条继承式状态链不套用 4.0 的 backend 管线描述。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/renderer/CCRenderState.cpp src/cocos/renderer/CCMaterial.cpp src/cocos/renderer/CCTechnique.cpp src/cocos/renderer/CCPass.cpp -o /tmp/cocos2d-3x-s60
/tmp/cocos2d-3x-s60
~~~

日志先显示程序状态应用，再依次显示 Material、Technique、Pass 的混合/深度设置。
