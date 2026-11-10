# 第 42 课：AudioSource 音量与 one-shot 并发

**本课问题：** 一个循环音源之外，短音效怎样并发播放并在通道不足时回收？

## 观察结果

`AudioSource.loop/volume` 控制循环播放器；`playOneShot(clip, volumeScale)` 创建独立短音效，音量为 source volume × 倍率。自然结束后实例从活动列表移除。通道满时先淘汰最早的 one-shot；本课将上限缩为 3 便于观察，3.8 Web PAL 源码上限为 24。

## 源码位置

- [AudioSource.loop 与 volume](../../engine/3.8.7engine/cocos/audio/audio-source.ts#L197) 更新当前 Player。
- [playOneShot](../../engine/3.8.7engine/cocos/audio/audio-source.ts#L430) 按 source 音量和倍率创建独立播放器；自然结束时移除活动记录见 [onEnd](../../engine/3.8.7engine/cocos/audio/audio-source.ts#L441)。
- [AudioManager 通道淘汰](../../engine/3.8.7engine/cocos/audio/audio-manager.ts#L87)：通道达到上限时优先停止最早的 one-shot；[Web PAL 通道数](../../engine/3.8.7engine/pal/audio/web/player.ts#L106)。

独立代码：[页面入口](src/main.ts)、[AudioSource](src/cocos/audio/audio-source.ts)、[AudioManager](src/cocos/audio/audio-manager.ts)、[Web PAL Player](src/pal/audio/web/player.ts) 和两段 WAV。

## 简化范围

使用 DOM Audio 展示 Web PAL；把实际 Web 上限 24 改为 3 以观察淘汰。one-shot 不返回实例 ID，不能单独停止；本课省略平台加载模式和音频解码缓存。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，先启循环背景音，再连续提交四路音效；背景音占一个通道，第三路音效开始淘汰较早 one-shot。
