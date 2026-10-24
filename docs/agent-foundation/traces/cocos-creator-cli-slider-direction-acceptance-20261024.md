# Cocos CLI Slider direction 枚举验收（Creator 2.4.15）

本记录验证 `cc.Slider.direction` 枚举可经 CLI 由 Horizontal 改为 Vertical，整工程关闭/重开后读回，并恢复原枚举值。未使用桌面 UI 自动化。

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`；Creator 2.4.15；CLI 0.12.56；扩展 0.8.86。
- 场景 UUID：`2c12110c-6f11-4a89-bcd4-1941dc757ca4`；节点 `CliAcceptanceScene/Canvas/CliSliderTest` UUID `07762af0-78a7-4529-9cff-846c1a39d6e0`。
- Slider 组件 ID：`b6IBIFAiJDYpWDT9COncUZ`。CLI Inspector 声明 `direction` 枚举值 `Horizontal=0`、`Vertical=1`。
- Apply：operation `40334cb0-0315-447b-8a35-92e1eb164012`，plan hash `925f9004c344ed921c5e61e8a02b3ae9e9a4a90ce4c3f04333d8a76a39d79a21`，将 0 改为 1；Creator 回执确认磁盘属性 `direction=1`、场景 SHA `c8b0c9f2af809c53e70a20554b04f15ad7c98c6a109f48c4abed80bb548944dc`。
- 第一次 CLI 整工程重开后，新 Creator 实例 `ad1141c0-12f9-44c9-9d73-efd948109ed7` 的 `creator.project.info` 与 `creator.scene.ui.inspect` 核对路径、Creator 版本、活动场景和 `direction=1`；磁盘 `.fire` 同值。
- Restore：反向 operation `18efb082-7f67-461a-ae72-ab2d736a0d05`，plan hash `96a80e7755847b8ea01f1ab7a6e51358984096065a450aa8d4f4b13fe4099277`，恢复 1→0；Creator 回执确认磁盘属性为 0，场景 SHA 恢复为基线 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`。
- 第二次 CLI 整工程重开后，新 Creator 实例 `812aeacf-e676-41fb-ba94-045d7ff3b485` 再次核对工程身份；Inspector 读回 `direction=0`，`.fire` 和 `.meta` 哈希均恢复到基线（`.meta` SHA `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`）。

结论仅覆盖 `direction` 的枚举序列化、关闭/重开读回和精确反向计划恢复；Slider 的 handle、拖动及 `slideEvents` 尚未验证。
