# 第 40 课：AudioClip 到 PAL AudioPlayer

**本课问题：** Creator 3.8 怎样把 AudioClip 接到 Web 音频实现？

## 观察结果

AudioSource 设置 clip 时取出 nativeAsset.url，调用 PAL AudioPlayer.load。Web 实现再选择 DOM Audio 或 Web Audio；播放器加载完成后，按钮点击才调用 play。

## 源码位置

- [音频资源下载器](../../engine/3.8.7engine/cocos/audio/audio-downloader.ts#L31)：将 URL 交给 PAL AudioPlayer.load，并封装成 AudioMeta。
- [AudioClip.nativeAsset](../../engine/3.8.7engine/cocos/audio/audio-clip.ts#L80)：保存资源元信息和 Player。
- [AudioSource._syncPlayer](../../engine/3.8.7engine/cocos/audio/audio-source.ts#L121)：设置 clip 后按 URL 创建平台播放器。
- [Web PAL AudioPlayer.load](../../engine/3.8.7engine/pal/audio/web/player.ts#L66)：按加载模式和 AudioContext 支持情况选择 DOM Audio 或 Web Audio。
- [AudioSource.play](../../engine/3.8.7engine/cocos/audio/audio-source.ts#L366)：将播放请求交给已创建的 Player。

本课代码：[AudioClip](src/cocos/audio/audio-clip.ts)、[AudioSource](src/cocos/audio/audio-source.ts)、[Web PAL Player](src/pal/audio/web/player.ts)、[页面入口](src/main.ts)。

## 简化范围

只实现 Web DOM Audio 分支；省略 AudioMeta 工厂、Web Audio 解码器、平台分发和音频并发管理。加载完成后再点击播放，满足浏览器用户手势要求。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，等按钮可用后点击“播放 AudioClip”。
