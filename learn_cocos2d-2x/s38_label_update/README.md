# 第 38 课：CocoStudio Label 文本更新

**本课问题：** CocoStudio 的 `ui::Label` 怎样把新文本送到可绘制纹理？

## 观察结果

`ui::Label::setText` 把文本交给内部 `CCLabelTTF`。后者检查字符串是否变化，再同步重建 TTF 纹理并更新 Sprite 尺寸。因此调用返回时，纹理代号和宽度已更新。

## 源码位置

- [CocoStudio Label::setText](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/UIWidgets/UILabel.cpp#L78)：转发到内部 renderer。
- [Label::initRenderer](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/UIWidgets/UILabel.cpp#L72)：创建并挂载 `CCLabelTTF`。
- [CCLabelTTF::setString](../../engine/cocos2d-x-2/cocos2dx/label_nodes/CCLabelTTF.cpp#L174)：字符串变化时调用 `updateTexture`。
- [updateTexture](../../engine/cocos2d-x-2/cocos2dx/label_nodes/CCLabelTTF.cpp#L293)：生成新纹理并同步 Sprite 尺寸。

本课代码：[CocoStudio Label](src/extensions/CocoStudio/GUI/UIWidgets/UILabel.h)、[Label 转发](src/extensions/CocoStudio/GUI/UIWidgets/UILabel.cpp)、[CCLabelTTF](src/cocos2dx/label_nodes/CCLabelTTF.h)、[TTF 更新](src/cocos2dx/label_nodes/CCLabelTTF.cpp)、[CCSprite](src/cocos2dx/sprite_nodes/CCSprite.h)、[CCTexture2D](src/cocos2dx/textures/CCTexture2D.h)、[纹理实现](src/cocos2dx/textures/CCTexture2D.cpp)、[入口](src/main.cpp)。

## 简化范围

只保留 UI wrapper、TTF renderer、纹理替换和尺寸同步。固定字符宽度是测量模型；省略字体平台后端、Widget 布局、内存引用计数和实际绘制。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/CocoStudio/GUI/UIWidgets/UILabel.cpp src/cocos2dx/label_nodes/CCLabelTTF.cpp src/cocos2dx/textures/CCTexture2D.cpp -o /tmp/cocos2d-2x-s38
/tmp/cocos2d-2x-s38
~~~
