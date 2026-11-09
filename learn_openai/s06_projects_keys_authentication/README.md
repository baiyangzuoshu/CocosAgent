# 第 6 课：Project、API Key 和身份验证

**目标：** 说清 Project、调用身份、API Key 和请求认证的关系，并能判断开发、生产和管理任务分别该用什么凭证。

## 本课问题

API Key 是什么？为什么创建了 Project 还需要密钥？谁的身份在实际请求中被使用？

## 前置知识

- [第 1 课](../s01_system_model_api_sdk_app/README.md)：模型、API、SDK 和应用各自的职责。
- [第 5 课](../s05_model_selection/README.md)：选择模型时要考虑功能和用量归属。

## 官方资料

- [API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys)：区分开发者身份、服务账号、Project Key 和 Admin Key，并了解密钥的管理边界。
- [API Overview：Authentication](https://developers.openai.com/api/reference/overview)：查看 Bearer 认证、Project/Organization header 和请求归属。
- [Project service accounts](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/projects/subresources/service_accounts/methods/create)：查看服务账号与项目的关系。
- [Error codes：401](https://developers.openai.com/api/docs/guides/error-codes)：理解凭证错误、项目或组织不匹配以及权限不足等常见认证问题。

## 1. Organization、Project、身份与密钥各自做什么

| 名称 | 作用 | 例子 |
| --- | --- | --- |
| Organization | 管理组织成员和组织级设置 | 某个团队或公司的 API 工作区 |
| Project | 将资源、成员和用量按应用或环境隔离 | RPG 的开发项目、生产项目 |
| 身份 | 表明谁或哪个工作负载在调用 | 开发者用户、生产服务账号 |
| API Key | 供请求认证使用的秘密凭证 | 某开发者或服务账号在一个 Project 中使用的密钥 |

Project 是资源和访问管理的分界之一，多个 Project 可用来隔离不同应用或环境的资源、成员和用量。Project 本身不是调用凭证；请求仍需通过 API Key 或受支持的短期访问令牌认证。[API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys)、[API Overview](https://developers.openai.com/api/reference/overview)

## 2. API Key 与身份验证

API Key 是能证明调用者凭证的秘密。HTTP 请求通常通过 `Authorization` header 发送 Bearer 凭证：

```http
Authorization: Bearer $OPENAI_API_KEY
```

在这个示意中，`$OPENAI_API_KEY` 是服务端环境变量的名称，不是实际密钥。服务端读取秘密并将它放进 HTTPS API 请求；不要把 Key 写进前端代码、移动端应用、源码仓库或日志。[API Overview：Authentication](https://developers.openai.com/api/reference/overview)

可以把一次调用拆成两个问题：

1. **认证（Authentication）：** 提供的 Bearer Key 或短期令牌是否有效，属于哪个身份？
2. **授权（Authorization）：** 这个身份在所属 Project 中获准做什么？

密钥范围可以限制能力，但不会给所属用户或服务账号增加它本来没有的权限；有效访问由密钥限制和所有者的有效权限共同决定。[API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys)

## 3. 开发者 Key、服务账号 Key 和 Admin Key

- **个人开发或探索：** 可用开发者自己的 Project Key。请求使用该用户在 Project 中的访问权限。
- **部署中的服务、定时任务或 CI：** 用属于 Project 的服务账号，让工作负载拥有独立身份、权限和生命周期；服务账号的 API Key 用来认证其模型请求。
- **组织管理自动化：** Admin Key 用于管理 Project、服务账号等 Admin API 操作。它属于不同用途的凭证，留在受信任的管理服务里，不放进应用的普通模型调用路径。

OpenAI 的凭证指南建议不要把某位开发者的个人 Key 分享给团队，或把个人身份作为生产应用的长期身份。服务账号与它拥有的 Key 是不同对象：换 Key 不必更换服务账号身份。[API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys)

## 4. 用量归属与 Project header

Project 帮助把应用的访问和用量分开。对于属于多个组织，或使用旧式用户 Key 的特定情况，请求可以通过 `OpenAI-Organization` 和 `OpenAI-Project` headers 指明使用上下文；这些 headers 是项目/组织选择信息，不是代替 Bearer Key 的认证凭证。常见的项目 Key 已带有自己的项目范围，具体以当前凭证类型和 API 文档为准。[API Overview](https://developers.openai.com/api/reference/overview)

```http
Authorization: Bearer $OPENAI_API_KEY
OpenAI-Project: $OPENAI_PROJECT_ID
```

本例说明两种 header 的用途不同：第一行放秘密凭证；第二行是 Project ID。Project ID 不能代替 API Key。

## 5. 管好 Key 的生命周期

1. 在服务端环境变量或 Secret Manager 中保存 Key。
2. 按应用或工作负载分配合适身份，并只授予完成任务所需权限。
3. 按组织策略设置有效期，监控 Key 的归属和使用情况。
4. 轮换时先签发替代 Key，更新并验证服务，再撤销旧 Key。
5. 如果 Key 泄露，尽快撤销或轮换，并检查使用记录。

服务账号 Key 的完整值只会在创建时返回一次。把 Key 放进浏览器、移动 App、代码仓库、日志或用户可见的错误信息，会让拿到该值的人以其有效权限发起请求。[API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys)

## 观察练习

为这三种工作选择身份和凭证，并说明理由：

| 工作 | 你会选什么？ |
| --- | --- |
| 开发者在本机试跑一个简单请求 | 待填写 |
| RPG 后端部署后持续调用 Responses API | 待填写 |
| 自动化系统创建 Project 并调整 Project API Key | 待填写 |

然后判断：代码中的 `OPENAI_PROJECT_ID` 能否替代 `OPENAI_API_KEY`？认证和授权分别回答什么问题？

## 本课检查

完成本课后，能解释：

- Project 用来组织与隔离应用资源、成员和用量；它不是 API 调用凭证。
- 身份说明是谁在调用，API Key 是用于认证的秘密凭证。
- Bearer Key 解决认证；身份与 Key 的有效权限共同决定授权范围。
- 开发者个人 Key、生产服务账号 Key 和 Admin Key 用在不同工作负载。
- Project ID、API Key 和认证 header 不是同一种东西。

## 简化与边界

- 本课只讲概念和凭证边界；创建 Project、生成 Key 的 Dashboard 操作会在后续第 7 课第一次请求中演示。
- 组织可配置更具体的 Project 角色、Key scope、有效期或其他认证政策；实际权限要查当前设置。
- OpenAI 也支持工作负载身份联合，用短期访问令牌认证；本课先建立 API Key 的基本模型，后续按需要展开。
