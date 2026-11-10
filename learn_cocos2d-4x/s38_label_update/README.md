# 第 38 课：ui::Text 与 Label 文本更新

**本课问题：** UI 文本变更后，内容数据在哪个阶段重建？

## 观察结果

`ui::Text::setString` 把字符串交给核心 `Label`，再读取 Label 的内容尺寸。`Label::getContentSize` 会在 `_contentDirty` 时立即调用 `updateContent`，所以文本尺寸在 setter 返回前已更新；Widget 的 renderer 适配标记则由后续 `visit` 清除。

## 源码位置

- [ui::Text::setString](../../engine/cocos2d-x-4/cocos/ui/UIText.cpp#L113)：转发文本并标记 renderer 适配状态。
- [Label::setString](../../engine/cocos2d-x-4/cocos/2d/CCLabel.cpp#L928)：保存 UTF-8 字符串并标记内容脏。
- [Label::visit](../../engine/cocos2d-x-4/cocos/2d/CCLabel.cpp#L1954)：访问阶段检测脏内容并调用 `updateContent`。

本课代码：[ui::Text](src/cocos/ui/UIText.h)、[Text 更新](src/cocos/ui/UIText.cpp)、[核心 Label](src/cocos/2d/CCLabel.h)、[Label 更新](src/cocos/2d/CCLabel.cpp)、[入口](src/main.cpp)。

## 简化范围

只保留 UI wrapper、核心 Label 的脏标记、visit 更新和尺寸回传。固定字宽是教学模型；省略字体系统、字形缓存、纹理、适配模式分支、场景访问和渲染提交。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/ui/UIText.cpp src/cocos/2d/CCLabel.cpp -o /tmp/cocos2d-4x-s38
/tmp/cocos2d-4x-s38
~~~
