# 第 12 课：GDScript tokenizer、parser 与编译

**目标：** 追踪 Godot 3.6 文本 token、AST parser、字节码 compiler 与 GDScript::reload 的接线。

## 本课问题

Tokenizer 暴露的 token 怎样被 parser 消费？compile 成功后脚本实例化之前还需要经过什么？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-3.6/` 快照。
- `engine/godot-3.6/modules/gdscript/gdscript_tokenizer.cpp:1116-1122`：摘录包含本课的关键函数实现。
- `engine/godot-3.6/modules/gdscript/gdscript_parser.cpp:8844-8862`：摘录包含本课的关键函数实现。
- `engine/godot-3.6/modules/gdscript/gdscript_compiler.cpp:2201-2232`：摘录包含本课的关键函数实现。
- `engine/godot-3.6/modules/gdscript/gdscript.cpp:582-649`：摘录包含本课的关键函数实现。

调用链：`source → GDScriptTokenizerText → GDScriptParser::parse → GDScriptCompiler::compile → GDScript::reload`

## 源码阅读顺序

1. `GDScriptTokenizerText::get_token` 逐 token 提供脚本文本；词法单元是 parser 输入，不等同于语法树。
2. `GDScriptParser::parse` 组织类、成员和函数的语法节点，并在 parser 阶段报告结构错误。
3. `GDScriptCompiler::compile` 把解析节点转换为可执行的 GDScriptFunction 指令；本代没有 Godot 4 独立 Analyzer 阶段。
4. `GDScript::reload` 管理解析、编译和错误清理，完成后脚本资源才能创建实例。

Godot 3.6 先由 tokenizer 提供 token，parser 构造类与函数节点，compiler 把 AST 转为 GDScriptFunction 指令。reload 协调 parser/compiler 并记录错误；本课不把 Godot 4 的独立 analyzer 阶段倒推到 3.6。

## 最小 Godot/GDScript 实验

主场景挂载一个含常量、变量、函数参数和简单表达式的脚本；运行时调用函数并打印结果。引擎加载主场景前必须先解析/编译这段脚本。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`compile_probe.gd`](compile_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 预期计算结果为 13。实验能观察成功脚本的执行，不代表自动覆盖语法错误路径。

**动手改一处：** 把函数参数类型（4.7）或表达式中的一个 token 改成错误值，先判断错误属于 parse、analysis 还是 compile 阶段；完成后恢复有效脚本。

## 简化与边界

实验只走有效脚本路径，不刻意引入 parse error；静态源码分别说明 tokenizer、parser、analyzer（仅 4.7）和 compiler 的职责。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [gdscript_tokenizer.cpp](src/upstream/modules/gdscript/gdscript_tokenizer.cpp.excerpt) | `engine/godot-3.6/modules/gdscript/gdscript_tokenizer.cpp` | 1116-1122 |
| [gdscript_parser.cpp](src/upstream/modules/gdscript/gdscript_parser.cpp.excerpt) | `engine/godot-3.6/modules/gdscript/gdscript_parser.cpp` | 8844-8862 |
| [gdscript_compiler.cpp](src/upstream/modules/gdscript/gdscript_compiler.cpp.excerpt) | `engine/godot-3.6/modules/gdscript/gdscript_compiler.cpp` | 2201-2232 |
| [gdscript.cpp](src/upstream/modules/gdscript/gdscript.cpp.excerpt) | `engine/godot-3.6/modules/gdscript/gdscript.cpp` | 582-649 |

## 下一课

[第 13 课：GDScript 实例执行、函数状态与 yield](../s13_gdscript_execution_yield/README.md)
