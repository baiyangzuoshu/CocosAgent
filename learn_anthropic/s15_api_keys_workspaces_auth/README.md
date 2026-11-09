# 第 15 课：API Key、工作区和认证如何配合？

**目标：** 能区分组织、工作区、身份与凭据；选择适合个人开发或共享服务的认证方式，并把长期密钥放在安全位置。

## 本课问题

拿到 Claude API Key 后，工作区还需要什么作用？什么时候用个人密钥、服务账号密钥或工作负载身份联邦？API Key 应放在游戏客户端、网页代码还是服务端？

## 官方资料

- [Get your Claude API key](https://platform.claude.com/docs/en/get-api-key)：创建、选择类型、保存和使用 API Key。
- [Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)：API Key、Workload Identity Federation 和 App Attest 的认证方式与工作区选择规则。
- [Workspaces](https://platform.claude.com/docs/en/manage-claude/workspaces)：组织内的工作区、成员与服务账号、API 用量和限额。
- [Workload Identity Federation](https://platform.claude.com/docs/en/manage-claude/workload-identity-federation)：用受信任的身份提供方换取短期 API 访问令牌。
- [Admin API keys](https://platform.claude.com/docs/en/manage-claude/admin-api-keys)：管理组织与控制面的另一类凭据。

核对日期：2026-11-10。凭据类型、Console 页面和认证选项可能更新；以以上官方文档为准。

## 1. 先分清四个概念

| 概念 | 负责什么 | 不代表什么 |
| --- | --- | --- |
| **Organization（组织）** | 管理成员、管理员、API 使用与集中账单。 | 不是某一个 API Key，也不是单个项目。 |
| **Workspace（工作区）** | 在组织内隔离项目或环境的 API 用量，管理可访问成员、资源以及工作区级限额。 | 工作区 ID 不是认证凭据；知道 ID 不会自动获得访问权限。 |
| **Identity（身份）** | 说明请求代表谁，例如个人用户、服务账号，或经信任配置的云工作负载。 | 一个身份不等于一个工作区；它只能访问被授予的范围。 |
| **Credential（凭据）** | 让 API 验证请求来源，例如静态 API Key、WIF 换来的短期令牌或 App Attest 令牌。 | 凭据本身不应被当成应用代码、用户输入或普通配置值。 |

可以把请求理解成两步：凭据先证明身份；再由密钥范围、工作区成员权限和工作区选择，确定请求在哪个工作区执行。

## 2. API Key 类型和工作区范围是两件事

创建 API Key 时，一方面选择它代表的身份，另一方面可以选择是否将它限制在某个工作区。不要把“Workspace key”这个旧密钥类型和“一个用户/服务账号密钥被限制在单个工作区”混为一谈。

| Key 类型 | 代表谁 | 常见用途与生命周期 |
| --- | --- | --- |
| **Personal key（个人密钥）** | 创建者本人，并继承该用户在组织和工作区中的权限。 | 适合个人开发；用户离开组织后密钥会失效。 |
| **Service account key（服务账号密钥）** | 组织中的非个人服务账号。 | 适合 CI、生产服务、自动化任务或团队共享的工作负载；按需把服务账号加入工作区并授予权限。 |
| **Workspace key（工作区密钥，legacy）** | 不绑定所有者，归创建它的工作区所有。 | 旧式密钥；创建者离开组织后仍会工作。Anthropic 建议优先用个人密钥或服务账号密钥，以便账户移除时凭据也失效。 |

另一个独立选择是**工作区范围**：

- **限制到一个工作区的 Key：** 只能在创建时选定的工作区执行请求，可省略工作区 ID 请求头。
- **未限制到单个工作区的 Key：** 每次请求都要提供目标工作区 ID；代表该密钥的个人或服务账号还必须有那个工作区的访问权限。
- **归属某工作区的旧式 Workspace key：** 总在创建它的工作区执行。

每个组织都有 Default Workspace。工作区可以分开管理成员、API 资源和使用限额。归档工作区会停用其中的资源，并让创建于该工作区的密钥归档；这是不可逆操作，先确认依赖它的服务已经迁移。[Workspaces](https://platform.claude.com/docs/en/manage-claude/workspaces)

## 3. 三种认证方式分别适合什么场景？

| 方式 | 凭据特点 | 适合场景 | 主要注意点 |
| --- | --- | --- | --- |
| **API Key** | 在 Claude Console 创建的静态密钥，每次请求以 Bearer token 发送。 | 本地开发、试验、脚本，以及有可靠密钥存储的服务端应用。 | 是长期秘密；创建时完整值只显示一次。设置过期时间、存进秘密管理器，并在泄露时禁用或删除。 |
| **Workload Identity Federation（WIF）** | 可信身份提供方的身份令牌换取短期 Claude API 令牌。 | 已运行在 AWS、Google Cloud、Azure、CI/CD 或 Kubernetes 等身份环境里的服务端工作负载。 | 可避免长期 Claude API Key，但仍依赖身份提供方和信任规则配置；并非自动获得端到端安全。 |
| **App Attest** | 为已注册且经过 Apple App Attest 证明的 iOS/macOS 应用签发短期访问令牌。 | 符合官方限制、希望由 iOS/macOS 应用直接访问 Claude API 且没有自建代理的产品。 | 令牌范围受限；官方当前说明仅可调用 Messages API。不是可移植到网页、Android 或云平台的通用 Key。 |

API Key 和 WIF 可访问 Claude API 的端点；WIF 将长期 API Key 换成短期令牌。App Attest 是针对特定 Apple 客户端的方式。具体支持平台、令牌范围与配置步骤查看 [Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)。

## 4. 普通 API Key 怎样进入请求？

对直接 Claude API，官方建议使用 Authorization Bearer 认证。SDK 会从 ANTHROPIC_API_KEY 环境变量读取密钥，并自动处理标准认证头和 API 版本头。

    Authorization: Bearer [从安全存储注入的密钥]
    anthropic-version: [当前文档指定的版本]
    content-type: application/json
    anthropic-workspace-id: [目标工作区 ID；密钥未绑定单一工作区时才需要]

旧式 x-api-key 请求头仍被支持，但编写新代码时优先遵循当前 Authentication 文档中的 Bearer 方式。若密钥已限制在一个工作区，请求可省略 anthropic-workspace-id；若未限制，则应提供它，且对应身份必须有该工作区访问权。[Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)

上面是请求头的形状，不含可用密钥。工作区 ID 是选择目标工作区的标识；认证由密钥或令牌完成。

## 5. 密钥应放在哪里？

### 本地开发与服务端

- 在 Claude Console 创建个人密钥供自己开发；共享或无人值守的服务使用服务账号密钥，或为云工作负载配置 WIF。
- 本地开发可将密钥从安全存储注入运行环境。生产环境优先使用云/CI 的密钥管理服务或短期身份凭据；程序运行时再读取环境变量。
- 不把真实密钥写入 Git、源代码、公开 issue、日志、截图、提示词或构建产物；访问日志时也要过滤 Authorization 等凭据字段。
- 密钥创建后完整值只显示一次。若遗失，无法在 Console 重新取回；创建替代密钥并更新部署。
- 怀疑密钥泄漏时立即禁用或删除，检查相关调用，再按“新建、部署、验证、撤销旧密钥”的顺序轮换。设置到期时间可缩短泄露密钥的有效期。

API Key 是每次请求携带的静态秘密。由这一属性可以推得：公开发布的前端、网页脚本、游戏包或移动应用无法可靠保守这种密钥，用户通常可以从代码或网络请求中提取它。因此，把 API 调用放在自己控制的服务端；若产品确实需要受支持的 iOS/macOS 应用直接请求，再研究 App Attest。不要把 ANTHROPIC_API_KEY 写进客户端配置或构建文件。[Get your Claude API key](https://platform.claude.com/docs/en/get-api-key) · [Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)

### API Key 不是 Admin API key

普通 API Key 用于 Claude API 的模型与功能请求。Admin API key 是独立的组织管理凭据，能访问管理文档明确列出的 Admin API；其权限更敏感，应单独保管，并且只交给确实需要管理组织资源的自动化。针对特定管理操作，官方也可能要求带有 org:admin 范围的 OAuth/WIF 令牌；应按那个端点的认证说明选择凭据。[Admin API keys](https://platform.claude.com/docs/en/manage-claude/admin-api-keys)

## 6. 选择方案的小例子

| 需求 | 起点 |
| --- | --- |
| 个人在本机验证第一个请求 | 个人 API Key，选择测试工作区；通过环境变量或本地安全存储提供给 SDK。 |
| 团队的生产后端部署在云上 | 给生产服务建立服务账号并限制工作区；云环境已有身份能力时比较 WIF 与服务账号 Key。 |
| 网页或游戏客户端需要 Claude | 由自己的后端持有 Key 并调用 API；不要把静态 Key 放进玩家能下载的客户端。 |
| iOS/macOS 产品想直接调用且不维护代理 | 阅读 App Attest 接入条件、支持范围和计费到工作区的方式。 |
| 一个组织有测试与生产两套流量 | 分别使用工作区或其他适当隔离方式，核对成员权限、密钥范围和限额；不要仅凭 Key 名称假设已完成隔离。 |

若项目使用 Amazon Bedrock、Google Cloud 或 Microsoft Foundry，认证凭据由对应渠道的文档决定，不要把 Claude API 的静态 API Key 规则直接套到云平台。渠道选择回看第14课。

## 7. 练习：找到授权链中的问题

1. 某个 API Key 已绑定到 Dev 工作区，但请求还发送了 Prod 的工作区 ID。应检查什么？
2. 生产服务由多人维护，仍使用离职员工个人名下的 Key。应该怎样调整？
3. Web 游戏把 API Key 写在客户端配置文件中，并将配置加密后一起打包。这个方案能否保密？
4. CI 已能取得 GitHub Actions 的 OIDC 身份令牌。减少长期 Claude API Key 的方式是什么？
5. 部署使用未绑定工作区的 Key，但忘记了工作区请求头。需要在哪两处核对？

**参考答案：**

1. 单工作区 Key 只能访问其绑定的 Dev 工作区；为 Prod 选择合适的凭据和授权范围，不要靠改请求头扩大权限。
2. 将共享工作负载改为服务账号 Key 或配置 WIF，授予所需工作区访问权，再撤销个人 Key。
3. 不能。客户端包可被下载和分析；如果客户端必须自行解密，解密逻辑或材料也可能被提取。把静态 Key 留在后端，或使用适用于目标客户端的官方认证方式。
4. 按官方 WIF 流程配置 GitHub Actions 的身份发行者、服务账号和信任规则，换取短期令牌。
5. 核对请求是否带有 anthropic-workspace-id，以及代表该密钥的用户或服务账号是否已加入并获准访问该工作区。

## 本课结论

组织负责成员和整体账户治理；工作区隔离 API 用量、资源、访问成员和限额；身份说明请求代表谁；凭据用于证明身份。选择密钥类型、工作区范围和认证方式时，按应用运行环境、密钥生命周期与最小权限来决定。API Key 是秘密，应由后端或安全凭据设施持有。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- 本课聚焦直接 Claude API 的身份、凭据与工作区；云平台认证请看第14课的对应渠道文档。
- 本课不配置真实凭据、不发起 API 请求，也不替代组织自己的密钥管理标准。
