# 第 27 课（CPP19）：错误处理与异常

**目标：** 用异常表达函数无法完成任务的情况，并观察栈展开期间 RAII 对象如何自动清理资源。

## 本课问题

- 函数抛出异常后，控制流如何找到处理它的代码？
- 局部资源管理对象会在进入 `catch` 之前销毁吗？
- 应该在哪里捕获异常并处理错误？

## 代码结构

~~~text
s27_cpp_errors_exceptions/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
int build_count(int count)
{
    auto resource = std::make_unique<CleanupTrace>();
    if (count < 0) {
        throw std::invalid_argument{"count cannot be negative"};
    }
    return count;
}
~~~

完整程序还包含正常路径和最外层异常处理，位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s27
/tmp/learn-cpp-s27
~~~

预期输出：

~~~text
resource released
valid result: 3
resource released
caught: count cannot be negative
~~~

## 观察要点

- `build_count` 无法接受负数时，按值抛出 `std::invalid_argument`，表示函数不能完成当前任务。
- 正常返回和抛出异常都会离开 `build_count` 的作用域。局部 `std::unique_ptr` 自动销毁它拥有的 `CleanupTrace`；发生异常时，这个清理发生在控制流进入 `catch` 之前。
- `main` 在可以向用户报告错误的边界捕获异常。`catch (const std::exception& error)` 通过基类常量引用处理标准异常，不复制异常对象，也不会切片；`what()` 提供错误说明。
- 不需要在每一层都捕获异常。只有能恢复、转换错误或给出有用信息的层才应捕获；无法处理时让异常继续向上层传播。
- `CleanupTrace` 的析构输出只为观察生命周期；实际代码中可由 `unique_ptr`、容器、锁守卫和文件句柄等 RAII 类型管理资源。

## 动手练习

1. 用 `build_count(0)` 和其他非负数测试正常返回路径，观察资源仍会自动释放。
2. 把错误改成 `std::runtime_error`，观察 `std::exception` 基类引用仍可捕获它。
3. 在函数中增加另一个局部智能指针，触发异常后观察各个局部对象都在进入处理器前销毁。

## 简化说明

- 示例使用 `std::invalid_argument` 表示输入不满足函数要求，不比较异常与错误码方案的完整适用范围。
- `CleanupTrace` 不代表真实文件或引擎资源；它只提供可见的析构输出。资源释放依赖 `std::unique_ptr` 的生命周期。
- 本课不讨论强异常保证、`noexcept`、自定义异常层次或析构函数中抛异常。

## 参考资料

- [C++ 工作草案：抛出异常](https://eel.is/c++draft/except.throw)
- [C++ 工作草案：异常处理器](https://eel.is/c++draft/except.handle)
- [C++ Core Guidelines：E.2、E.6、E.15、E.17（异常与 RAII）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
