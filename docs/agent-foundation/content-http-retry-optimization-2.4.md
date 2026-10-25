# 2.4 动态内容下载：永久 HTTP 错误快速失败

## 结论

在 2.4.15 资源下载器中，HTTP 404 和其他永久性 4xx 原先与 503、网络中断一样重试。压力场景里，一个确定不存在的生成资源因此占用约 6 秒才回执。源码现已改为：HTTP 4xx 除 408、425、429 外立即返回；5xx、临时限流/超时状态及没有 HTTP 状态的传输错误保留原重试次数。

源码已修改并由聚焦测试覆盖。集成压力测试将改动按等价逻辑临时应用到现有 Web-Mobile 包的引擎脚本响应中；**Creator 自定义引擎尚未编译并选入工程，因此集成结果不能写成正式构建已包含该源码修复。**

## 问题复现

复现环境为 Creator 2.4.15 的 `p1-web-20261009` Web-Mobile 构建，由本机 Chrome headless + SwiftShader 打开，1280×800；8 轮、32 个临时 Sprite。压力纹理和解析夹具、Canvas、构建包、浏览器与服务器均在本机。测试在失败验收阶段将缺失资源 UUID 对应的 native PNG 请求固定返回 HTTP 404。

未修改的构建对同一 URL 请求 4 次（首发加 3 次重试），等待 6010.9 ms 后返回错误。当前画面仍使用原 SpriteFrame；旧 Texture 保持有效、引用数和 Asset Cache 不变。原始记录见 [`404 修复前轨迹`](traces/cocos-agent-content-stress-2.4-web-2026-10-10T03-18-16-916Z-6fed76.json)。这一运行的 30 FPS 帧间隔 P95 为 166.8 ms，压力验收因帧预算失败；不要把失败资源保留不变量通过写成整轮验收成功。

## 源码定位和方案取舍

调用链落在 `engine/2.4.15engine/cocos2d/core/asset-manager/download-file.js::downloadFile` 与 `engine/2.4.15engine/cocos2d/core/asset-manager/utilities.js::retry`：XHR 的非 200 响应先包装成普通 `Error`，`retry` 只检查错误是否存在和剩余次数，无法区分永久 HTTP 错误与临时错误。

实现分两步：

1. `downloadFile` 将 XHR `status` 附加到 HTTP 响应错误。
2. `retry` 对 400–499 中除 408、425、429 之外的状态直接完成；其他错误继续沿用原次数和 2 秒间隔。

没有下调全局重试次数，因为这会缩短 503、限流和无状态网络故障的恢复机会。新规则只依赖真实 HTTP 响应状态；DNS、连接中断和 XHR 状态 0 仍按旧策略重试。

## 改动后测量与回归

同一构建输出未落盘修改。压力运行器仅在静态服务器内存中对返回的 `cocos2d-js-min` 响应应用上述源码逻辑，并记录原/补丁响应 SHA-256。这避免了换包造成的变量，但属于集成实验补丁，不是 Creator 自定义引擎构建验收。

| 场景 | 请求次数 | 失败回执耗时 | 旧资源保留 | 整轮结果 |
| --- | ---: | ---: | :---: | --- |
| 修复前 HTTP 404 | 4 | 6010.9 ms | 是 | 30 FPS 帧预算失败 |
| 补丁后 HTTP 404，第一次 | 1 | 2.6 ms | 是 | 其他帧间隔样本触发 30 FPS 预算失败 |
| 补丁后 HTTP 404，重复 | 1 | 3.2 ms | 是 | headless 截图期间帧间隔触发 30 FPS 预算失败 |
| 补丁后 HTTP 503 | 4 | 6013.5 ms | 是 | 压力验收通过 |

修复后的 404 两次都只发一个请求，回执在 2.6/3.2 ms 到达，候选资源失败后旧画面、旧 Texture、引用数均被保留。帧间隔预算在这两次运行中分别为 35 和 52 ms；测试含 headless 截图，故这两次不能标成整轮通过。HTTP 503 回归仍发 4 次请求、约 6 秒后返回，旧资源保持有效；这一轮压力验收通过。轨迹分别见 [`404 首次修复态`](traces/cocos-agent-content-stress-2.4-web-2026-10-10T03-21-20-429Z-76b892.json)、[`404 重复修复态`](traces/cocos-agent-content-stress-2.4-web-2026-10-10T03-24-49-914Z-d2f0ef.json) 和 [`503 回归`](traces/cocos-agent-content-stress-2.4-web-2026-10-10T03-23-07-281Z-a7056e.json)。

聚焦测试实际加载这两个 2.4.15 源文件，验证 400/401/403/404/410 一次失败、408/425/429/500/503 保留 4 次尝试、间隔仍为 2000 ms、状态 0 的网络错误仍重试，且 200 成功不变：

```sh
node docs/agent-foundation/probes/cocos-2x-http-retry.test.cjs
node --check engine/2.4.15engine/cocos2d/core/asset-manager/download-file.js
node --check engine/2.4.15engine/cocos2d/core/asset-manager/utilities.js
node --check docs/agent-foundation/probes/cocos-content-stress-2.4-live.mjs
```

## 构建来源与边界

按 [Creator 2.4 引擎定制流程](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/engine-customization.html)，在 `engine/2.4.15engine/` 安装其声明依赖后执行 `./node_modules/.bin/gulp build-dev`，构建成功。生成的忽略目录 `bin/cocos2d-js-for-preview.js` 包含 `error.status = xhr.status` 和永久 4xx 快速终止分支；SHA-256 为 `edcc73bb150874a7f3e6e8b6c60e871d2d8ae1642bee285f5688e8c2a988083a`。2.4.15 Creator 的“项目设置 → 自定义引擎”已保存 JavaScript 引擎路径 `/Users/youjunmao/WORK/Cocos_Engine/engine/2.4.15engine`，记录在被忽略的 `2.4.15NewProject/local/settings.json`。

Creator 重载该引擎后的运行预览，以及基于该引擎重新生成 Web-Mobile 包的验收仍未完成：保存设置并关闭设置窗口后，桌面自动化通道连续返回 `noWindowsAvailable`/`timeoutReached`，Creator CLI 的只读 `--help` 调用以状态 134 退出。因而已有的 404/503 集成测量仍是对原构建的内存等价补丁试验，不能改述为自定义引擎运行或正式 Web-Mobile 构建结果。源码构建、项目选路、源码级测试和原构建集成对比均有证据；Creator 重载后的运行时接入是剩余验收项。

该变化仅针对 Creator 2.4.15 JS 资源管线。未新增 3.x 能力；未验收 Mac/移动原生、其他 HTTP 客户端或任意外部网络服务。HTTP 状态分类是固定规则；若业务服务器把永久错误错误地报告成 5xx，仍会按临时错误重试。
