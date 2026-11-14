# 第 12 课：GDScript tokenizer、parser、analyzer 与编译

**目标：** 逐段追踪 Godot 4.7 的 tokenizer 扫描、Parser、Analyzer、Compiler 与 GDScript::reload。

## 本课问题

parse 与 analyzer 分别负责什么？编译器何时进入？reload 对这几阶段如何处理错误？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-4.7/` 快照。
- `engine/godot-4.7/modules/gdscript/gdscript_tokenizer.cpp:1351-1385`：摘录包含本课的关键函数实现。
- `engine/godot-4.7/modules/gdscript/gdscript_parser.cpp:438-528`：摘录包含本课的关键函数实现。
- `engine/godot-4.7/modules/gdscript/gdscript_analyzer.cpp:6654-6669`：摘录包含本课的关键函数实现。
- `engine/godot-4.7/modules/gdscript/gdscript_compiler.cpp:3282-3324`：摘录包含本课的关键函数实现。
- `engine/godot-4.7/modules/gdscript/gdscript.cpp:737-902`：摘录包含本课的关键函数实现。

调用链：`source → GDScriptTokenizerText::scan → GDScriptParser::parse → GDScriptAnalyzer::analyze → GDScriptCompiler::compile → GDScript::reload`

## 源码阅读顺序

1. `GDScriptTokenizerText::scan` 把源文本扫描为 token 并保留词法位置；对照扫描状态与返回的 token。
2. `GDScriptParser::parse` 生成语法树，处理语句、表达式和声明结构；语法是否合法在这里初步确定。
3. `GDScriptAnalyzer::analyze` 对语法树做语义与类型解析；将它与 parser 的“结构正确”职责区分。
4. `GDScriptCompiler::compile` 消费经过分析的节点生成函数实现；`GDScript::reload` 负责阶段编排和错误回报。

4.7 把语法树生成和语义解析拆为 Parser 与 Analyzer：前者描述语法结构，后者解析类型、继承和表达式；Compiler 再生成函数实现。reload 管理这些阶段及错误收集。摘录只覆盖关键入口，不是整个语言实现。

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
| [gdscript_tokenizer.cpp](src/upstream/modules/gdscript/gdscript_tokenizer.cpp.excerpt) | `engine/godot-4.7/modules/gdscript/gdscript_tokenizer.cpp` | 1351-1385 |
| [gdscript_parser.cpp](src/upstream/modules/gdscript/gdscript_parser.cpp.excerpt) | `engine/godot-4.7/modules/gdscript/gdscript_parser.cpp` | 438-528 |
| [gdscript_analyzer.cpp](src/upstream/modules/gdscript/gdscript_analyzer.cpp.excerpt) | `engine/godot-4.7/modules/gdscript/gdscript_analyzer.cpp` | 6654-6669 |
| [gdscript_compiler.cpp](src/upstream/modules/gdscript/gdscript_compiler.cpp.excerpt) | `engine/godot-4.7/modules/gdscript/gdscript_compiler.cpp` | 3282-3324 |
| [gdscript.cpp](src/upstream/modules/gdscript/gdscript.cpp.excerpt) | `engine/godot-4.7/modules/gdscript/gdscript.cpp` | 737-902 |

## 下一课

[第 13 课：GDScript 实例化与引擎对象调用](../s13_gdscript_execution/README.md)
