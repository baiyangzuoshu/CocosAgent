# 第 38 课：CCLabelTTF 文本更新

**本课问题：** 1.x 修改文本后，新的字形图像怎样到达 Sprite？

## 观察结果

`CCLabelTTF::setString` 保存字符串，立即用新文本创建纹理，再把纹理和纹理尺寸交给 Sprite。输出中的纹理代号和宽度在函数返回前已经变化。

## 源码位置

- [setString 声明](../../engine/cocos2d-x-1/cocos2dx/include/CCLabelTTF.h#L56)：文本变化接口并提示它会重新创建 TTF 图像。
- [CCLabelTTF::setString](../../engine/cocos2d-x-1/cocos2dx/label_nodes/CCLabelTTF.cpp#L110)：生成纹理、设置 Sprite 纹理和纹理矩形。

本课代码：[CCLabelTTF](src/cocos2dx/include/CCLabelTTF.h)、[CCSprite](src/cocos2dx/include/CCSprite.h)、[CCTexture2D](src/cocos2dx/include/CCTexture2D.h)、[纹理实现](src/cocos2dx/textures/CCTexture2D.cpp)、[入口](src/main.cpp)。

## 简化范围

只保留字符串、TTF 纹理重建、Sprite 尺寸同步。固定字符宽度用于观察尺寸变化；省略平台字体后端、内存引用计数、锚点和实际绘制。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/label_nodes/CCLabelTTF.cpp src/cocos2dx/textures/CCTexture2D.cpp -o /tmp/cocos2d-1x-s38
/tmp/cocos2d-1x-s38
~~~
