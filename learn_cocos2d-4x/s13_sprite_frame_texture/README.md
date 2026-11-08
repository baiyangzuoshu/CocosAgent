# 第 13 课：SpriteFrame 与三角形贴图命令

**目标：** 看清 4.x 如何把 SpriteFrame 的贴图与区域 UV 带入 TrianglesCommand。

## 本课增量

SpriteFrame 持有 Texture2D 和区域矩形。Sprite::draw 从区域计算 UV，将纹理与四顶点、六索引装入 TrianglesCommand；Renderer 排序后提交命令。本例只显示图集左侧 64×64 区域。

## 源码位置

- `engine/cocos2d-x-4/cocos/2d/CCSpriteFrame.cpp:47-65,97-116`：创建 SpriteFrame 并保存纹理、区域和裁剪信息。
- `engine/cocos2d-x-4/cocos/2d/CCSprite.cpp:224-234,1596-1615`：Sprite 初始化或切换 SpriteFrame。
- `engine/cocos2d-x-4/cocos/2d/CCSprite.cpp:1098-1127`：把 Sprite 的纹理和三角形数据加入 Renderer。
- `engine/cocos2d-x-4/cocos/renderer/CCTrianglesCommand.cpp:38-58`：命令保存三角形数据和渲染状态。

## 简化

样例的 Image 固定报告图集尺寸，Renderer 只打印命令，不执行 GPU 绘制；省略引用计数、旋转/裁剪、材质和真实批次缓冲。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/2d/CCSpriteFrame.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-4x-s13
/tmp/cocos2d-4x-s13
~~~

Renderer 输出 Player 对应的纹理路径、三角形数量和首个顶点 UV。
