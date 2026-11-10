# 第 46 课（ENG18）：音频播放与资源生命周期

## 本课代码快照

src/main.cpp 是独立 C++17 教学模型，模拟音频文件缓存、播放实例句柄、停止与自然结束。它不会播放声音，也不链接 Cocos2d-x 音频后端。

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror src/main.cpp -o /tmp/learn-cpp-s46
/tmp/learn-cpp-s46
~~~

预期观察：同一音频资源可对应两个播放句柄；播放实例结束后文件缓存仍存在，直到显式 uncache。课程结构参考 [Creator 第 41 课](../../learn_3.8cocoscreator/s41_audio_playback_lifecycle/README.md)。

本课模型已按上述命令编译并运行；这只验证课程示例，不代表已构建或运行 Cocos2d-x 工程。

**目标：** 跟踪音频路径如何进入 Cocos2d-x 4.0 的平台后端，区分一次播放的 `audioID` 与文件缓存，并掌握停止、清缓存和关闭 AudioEngine 的不同边界。

## 本课范围与证据

本课以仓库中的 Cocos2d-x 4.0 `AudioEngine` C++ 接口、公共实现和各平台后端做静态追踪；没有构建或播放音频。目标平台的格式支持、回调线程、解码时机和实际内存释放都需要单独运行验证。

v4 的接口是 `cocos2d::AudioEngine`，头文件为 `audio/include/AudioEngine.h`；不要照搬旧版 `cocos2d::experimental::AudioEngine` 命名空间。

## 播放路径

```mermaid
flowchart TD
    A[音频资源路径] --> B[AudioEngine::play2d]
    B --> C{已启用且文件存在?}
    C -- 否 --> D[返回 INVALID_AUDIO_ID]
    C -- 是 --> E[编译目标选择 AudioEngineImpl]
    E --> F[后端创建播放实例并返回 audioID]
    F --> G[公共层按原始路径和 ID 记录播放实例]
    G --> H[后端继续读取/解码并开始播放，时机因平台而异]
    H --> I[pause / resume / volume / stop / finish callback]
    J[AudioEngine::uncache(path)] --> K[停止该路径已登记的播放实例]
    K --> L[请求平台后端清理该路径缓存]
    M[AudioEngine::uncacheAll()] --> N[stopAll，再清理全部后端缓存]
    O[应用退出] --> P[AudioEngine::end]
```

公共 `AudioEngine::play2d()` 会检查引擎启用状态、懒初始化平台实现、检查 `FileUtils` 能否找到文件，并受同时播放数/Profile 限制。成功时它返回一个 `audioID`，并在公共表中记录路径、循环、音量和播放状态；任何前置检查或后端创建失败都可能返回 `INVALID_AUDIO_ID`。有效 ID 表示后端接受了这次播放请求，不等于已经听到声音。

```cpp
#include "cocos2d.h"
#include "audio/include/AudioEngine.h"

using namespace cocos2d;

// background.wav 是 cpp-tests/Resources 中的示例音频。
const std::string soundPath = "background.wav";
int audioID = AudioEngine::play2d(soundPath, false, 0.8f);

if (audioID == AudioEngine::INVALID_AUDIO_ID)
{
    CCLOG("AudioEngine did not create a playback instance");
    return;
}

AudioEngine::setFinishCallback(audioID, [](int finishedID, const std::string& filePath) {
    CCLOG("Finished audio %d: %s", finishedID, filePath.c_str());
});
```

同一文件可以对应多个并行播放实例，所以 `audioID` 是一次播放的句柄，不是音频文件的缓存 ID，也不是自动绑定到某个 Node 的资源所有者。需要时用这个 ID 调整音量、暂停、恢复或停止；如果声音不应超过所属场景/对象的生命周期，就在该对象的退出策略中显式停止并清空保存的 ID。

## 播放实例与文件缓存是两层

| 操作 | 公共层对播放实例的处理 | 文件/后端缓存 |
| --- | --- | --- |
| `pause(id)` / `resume(id)` | 改变指定实例状态 | 不等于清缓存 |
| `stop(id)` | 停止实例并从公共 ID 表移除 | 单独停止一个实例不会调用 `uncache` |
| 自然播放结束 | `setFinishCallback(id, ...)` 可接收完成通知 | 完成通知不表示显式清了文件缓存 |
| `uncache(path)` | 按公共表中登记的路径停止相关实例 | 再委托平台后端清理该路径缓存 |
| `uncacheAll()` | 先 `stopAll()` 并清除播放实例表 | 再委托后端清全部缓存 |
| `end()` | 结束 AudioEngine 全局实现 | 应在应用退出前调用，不是每个 Scene 的清理函数 |

公共实现用传入的路径字符串关联活动 ID；同一资源反复播放时，路径对应的是一组 ID。清理单个资源时复用与 `play2d()` 相同的逻辑路径，避免把路径别名误当成同一条公共登记记录。

`preload(path, callback)` 是另一条入口：公共层同样检查启用状态和文件存在，然后把加载请求交给目标平台实现；callback 报告该后端的加载成败。它可用于把读取/解码时机移到首次播放之前，但具体完成时机和 callback 执行线程要按目标后端核对。不要仅凭 `preload()` 被调用就断言缓存已准备好，也不要未经线程验证就在 callback 中操作 UI 节点。

## 平台实现决定缓存细节

`AudioEngine.cpp` 按编译目标选择 Apple、Android、Windows 或 Linux 的 `AudioEngineImpl`；`cocos/audio/CMakeLists.txt` 也按平台选取实现文件。公共 API 相同，不表示每个平台使用相同解码器、缓存对象、文件格式或回调时序。

例如，本地 Apple/Windows/Android 后端都能看到自己的音频缓存实现；Android 源码还维护 PCM 数据缓存。公共头文件的注释只列出了 iOS/macOS/Win32 缓存说明，不能据此推出所有平台的内部内存模型完全相同。`AudioEngine::uncache()` 只是公共清理请求；本课没有观察缓存字节数或底层解码对象何时真正释放。

格式也需要按平台验证。`cpp-tests` 的 `InvalidAudioFileTest` 用目标平台条件选择不同的无效格式，说明“文件存在”不等于该后端一定能解码。

## 清理示例

```cpp
// 场景/对象清理：只管理保存的这次播放实例。
if (audioID != AudioEngine::INVALID_AUDIO_ID)
{
    AudioEngine::stop(audioID);
    audioID = AudioEngine::INVALID_AUDIO_ID;
}
```

```cpp
// 若资源不再需要，清理与该路径关联的实例及后端缓存。
AudioEngine::uncache(soundPath);
```

```cpp
// 应用关闭前，由应用级生命周期调用一次。
AudioEngine::end();
```

在真实工程中，不要在 Scene 退出时随意调用 `uncacheAll()` 或 `end()`：前者会停止所有音频，后者会销毁全局 AudioEngine 实现，可能影响仍在播放的其他系统。`stop(id)`、`uncache(path)` 和应用关闭时的 `end()` 代表不同范围的清理。

## 动手观察

1. 追踪 `AudioEngine::play2d()` 中 `FileUtils` 检查、平台实现调用、ID 生成和公共路径/ID 表登记；分别记录无效路径和达到实例上限时的返回值。
2. 在 `cpp-tests` 中查看 `AudioControlTest`：跟踪单个 ID 的播放、暂停、恢复、音量、停止和 finish callback。
3. 查看 `AudioLoadTest` 的 preload/uncache 按钮回调，区分加载状态、实例停止与路径缓存清理。
4. 用目标平台测试同一个音频格式的加载、播放、完成回调、`uncache(path)` 后再次播放；记录平台、文件编码、路径和结果，不能从一个后端推广到其他平台。
5. 仅在应用退出流程中验证 `AudioEngine::end()`，不要把它放到可重复进入的 Scene 生命周期中。

这些是后续运行步骤，不是本课已播放音频或测量缓存的结果。`NewAudioEngineTest.cpp` 提供了测试入口，但本课没有运行它们。

## 简化说明

- 本课聚焦 `AudioEngine`，不展开旧 `SimpleAudioEngine`、音频焦点、Profile、流式大文件解码、平台会话和压缩格式参数。
- 文件路径使用 `cpp-tests/Resources/background.wav` 的相对路径；其他工程要确认 FileUtils 搜索路径和目标资源包。
- 仓库目前没有独立的 Cocos2d-x 音频 Skill；Creator 2.4 的音频 Skill 不等同于此 C++ 后端。本课只做本地源码静态分析。

## 参考资料

- [AudioEngine 公共 C++ 接口](../../engine/cocos2d-x-4/cocos/audio/include/AudioEngine.h)
- [AudioEngine 公共播放、ID、stop 与 uncache 实现](../../engine/cocos2d-x-4/cocos/audio/AudioEngine.cpp)
- [编译目标对应的平台音频源码选择](../../engine/cocos2d-x-4/cocos/audio/CMakeLists.txt)
- [Apple 音频缓存与播放实现](../../engine/cocos2d-x-4/cocos/audio/apple/AudioEngine-inl.mm)
- [Android 音频缓存与播放实现](../../engine/cocos2d-x-4/cocos/audio/android/AudioEngine-inl.cpp)
- [Windows 音频缓存与播放实现](../../engine/cocos2d-x-4/cocos/audio/win32/AudioEngine-win32.cpp)
- [Linux 音频引擎实现](../../engine/cocos2d-x-4/cocos/audio/linux/AudioEngine-linux.cpp)
- [NewAudioEngine 测试入口](../../engine/cocos2d-x-4/tests/cpp-tests/Classes/NewAudioEngineTest/NewAudioEngineTest.cpp)
- [示例音频文件](../../engine/cocos2d-x-4/tests/cpp-tests/Resources/background.wav)
- [Cocos2d-x v4 AudioEngine C++ API](https://docs.cocos2d-x.org/api-ref/cplusplus/v4x/d3/d0a/classcocos2d_1_1_audio_engine.html)
- [Cocos2d-x v4 音频引擎介绍](https://docs.cocos2d-x.org/cocos2d-x/v4/en/audio/engines.html)
- [Cocos2d-x v4 AudioEngine 命名空间变更](https://docs.cocos2d-x.org/cocos2d-x/v4/en/apichange/api_change_v4.html)
- [第 35 课：Scene、Node 与场景树](../s35_cocos2d_scene_node_tree/README.md)
- [第 41 课：FileUtils 与资源路径解析](../s41_cocos2d_fileutils_path_resolution/README.md)
