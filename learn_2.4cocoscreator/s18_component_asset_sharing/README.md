# 第 18 课：组件实例与资源共享

**目标：** Prefab 实例拥有独立节点、组件和 Sprite 对象，同时引用同一份 SpriteFrame 资源。

## 本课增量

在上一课的节点树复制上加入 `EnemyLogic` 和 Sprite 渲染对象。实例化两次后把 EnemyA 的 HP 改为 60，EnemyB 保持 100；两个 Sprite 不同，但使用同一个 SpriteFrame。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/platform/instantiate.js:223-285`：实例化时复制对象数据，Asset 对象直接复用。
- `engine/2.4.15engine/cocos2d/core/assets/CCPrefab.js:167-195`：Prefab 用模板节点创建实例。
- `engine/2.4.15engine/cocos2d/core/assets/CCSpriteFrame.js:62-65`：SpriteFrame 是 Asset；`engine/2.4.15engine/cocos2d/core/components/CCSprite.js:195-212`：Sprite 保存 `spriteFrame` 引用。

## 简化

组件复制只演示简单字段；本课的 HP 是数字。对象字段按浅复制保留引用，省略完整序列化、数组/嵌套数据复制及编辑器实例关联。SpriteFrame 作为 Asset 共享。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，页面状态显示节点、EnemyLogic 和 Sprite 对象彼此独立，SpriteFrame 相同，HP 分别为 60 和 100。
