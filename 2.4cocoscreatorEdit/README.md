# Cocos Creator Lite 0.1

这是一个面向 Cocos Creator 2.4.15 的简化编辑器实验。项目和场景使用自定义 JSON 格式，编辑器预览和 Web 输出通过 Creator 2.4.15 生成的 Web Mobile 运行时渲染。

默认复用 /Users/youjunmao/WORK/DenoA/electron 中已安装的 Electron 37.10.3 和 electron-builder，不修改 DenoA 的应用代码、窗口或产品配置。

先在 Cocos Creator 2.4.15 中构建 /Users/youjunmao/WORK/Cocos_Engine/2.4NewProject 的 Web 手机端，然后运行：

    npm run build
    npm run dev

如目录不同，可通过环境变量覆盖：

    COCOS_WEB_RUNTIME_SOURCE=/absolute/path/to/build/web-mobile npm run build
    DENOA_ELECTRON_ROOT=/absolute/path/to/DenoA/electron npm run dev

项目根目录包含 project.json，主场景由 mainScene 指向。场景 JSON 使用稳定节点 ID、父节点 ID、活动状态、二维变换和组件字段。0.1 版本支持 Canvas、Label 与 Sprite。

本版支持新建、打开、保存和重新打开；层级选择、增删和基础变换编辑；Label 文本、字号、颜色和 Sprite 尺寸、颜色编辑；运行时预览和 Web 文件夹导出。

本版不读取或写入 Creator 原生 .fire、Prefab 或资源数据库格式。
