# 第三方桥接边界检查

日期：2026-10-19。范围：本机第三方桥接负向协议检查；不是 Creator 实机验收。

## 工程身份与边界

Dashboard 当前显示已打开工程 `rank`，路径 `/Users/youjunmao/WORK/Cocos_Engine`，Creator 2.4.15。目标 `tank` 的预期路径为 `/Users/youjunmao/WORK/Cocos_Engine/tank`，身份不一致。因此没有进入 Creator、安装扩展、调用 Creator 命令或读取/比较项目文件。目标项目差异与恢复基线尚未核验。

## 本机桥接检查

起始 `bridge status` 回执为 `{"running":false}`。随后只在 `127.0.0.1` 启动桥接，不连接 Creator 工程。所有请求均未打印或记录 bearer token。

| 检查 | 输入 | 回执 | 结果 |
| --- | --- | --- | --- |
| 未知实例 | `GET /v1/instances/11111111-2222-4333-8444-555555555555/capabilities` | HTTP 404，`CREATOR_INSTANCE_NOT_FOUND` | 通过：实例不存在时拒绝调用 |
| 合同指纹不匹配 | `POST /v1/creator/register`；实例 `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee`，Creator `2.4.15`，扩展 `0.1.0`，指纹为 64 个 `0`，能力列表为空 | 首次返回 HTTP 500 `CREATOR_REGISTRATION_INVALID`；修复后重试返回 HTTP 400 `CREATOR_REGISTRATION_INVALID` | 通过：拒绝不匹配合同；已修正客户端注册错误的 HTTP 状态分类 |
| 非法脚本路径 | CLI `call --instance 11111111-2222-4333-8444-555555555555 --command creator.script.read --input '{"scriptPath":"../outside.ts"}'` | `INVALID_INPUT_FIELD` | 通过：在 Host 合同校验阶段拒绝，未派发到 Creator |
| Unicode 合法路径格式 | 合同校验输入 `creator.script.read` + `{"scriptPath":"安全/脚本.ts"}` | Host 合同格式校验通过 | 仅证明路径格式可表达；未读取 Creator 资源 |

## 重启与版本指纹

修复后停止旧桥接并重新启动：新 `bridgeId` 为 `0b785764-f927-4b1a-a9d0-f39b9e085e0c`，监听 `127.0.0.1:57808`。重启后 `instances list` 回执为 `{"instances":[]}`。桥接进程重启已验证；没有 Creator 扩展在线，故“重新发现 Creator 实例”未通过/未验证，不能以空列表记为成功。

本次文件摘要：

- `bridge/service.mjs`：`9aac5b297bc5baf0a7a249a1a08f69062f4756523b4eae4f04584b2456aec7c1`
- `bridge/contracts.mjs`：`cd45cde7cedc58f6b3bda5f8d36de60947934c291909b57b4354c7333614becd`
- `creator-extension/command-contract.json`（桥接合同 SHA-256）：`b22e8ed50ba5b109745107c51ffe9591c1f5343a747ca0df723fda7340cee74c`

## 结论

本机桥接可拒绝未知实例、错误合同和非法脚本路径；合同不匹配当前以 HTTP 400 回报。Creator 实例发现、CLI 与 Codex MCP 同实例调用、工程文件差异和 Creator 资源哈希均未验收，因为目标工程身份不符且没有 Creator 扩展会话。桥接目前保持运行，等待后续工程身份核对与扩展握手。
