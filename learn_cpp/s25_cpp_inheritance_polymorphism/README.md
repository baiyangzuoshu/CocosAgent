# 第 25 课（CPP17）：继承与多态

**目标：** 用抽象基类描述共同接口，通过虚函数让基类引用调用不同派生类的实现，并安全管理派生对象生命周期。

## 本课问题

- `Circle` 和 `Rectangle` 如何表达“是一种 `Shape`”的关系？
- 通过 `const Shape&` 调用 `area()` 时，如何执行实际对象对应的实现？
- 为什么通过基类指针拥有派生对象时，基类通常需要虚析构函数？

## 代码结构

~~~text
s25_cpp_inheritance_polymorphism/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
};

class Circle : public Shape {
public:
    double area() const override;
};
~~~

程序把不同形状放进 `std::vector<std::unique_ptr<Shape>>`，再通过基类接口逐个计算面积。完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s25
/tmp/learn-cpp-s25
~~~

预期输出：

~~~text
rectangle: 12.00
circle: 12.57
~~~

## 观察要点

- `Circle` 和 `Rectangle` 公有继承 `Shape`，表达它们都是一种形状；`Character` 有一个 `Position` 的关系则使用上一课的组合。
- `Shape` 有纯虚函数，因此它是抽象类，不能直接创建对象。派生类用 `override` 标明实现基类虚函数，编译器会检查函数签名是否匹配。
- `print_area(const Shape&)` 通过基类引用调用 `name()` 和 `area()`。实际执行哪个函数由对象的动态类型决定，这就是虚函数的动态派发。
- `std::vector<std::unique_ptr<Shape>>` 可以持有不同派生类型，同时保留其动态类型；按值存放 `Shape` 会发生对象切片。
- `Shape` 的析构函数是虚函数，因此通过 `std::unique_ptr<Shape>` 销毁派生对象时会正确调用完整析构链。
- 继承适合表达稳定的层级关系和多态接口；如果只需要复用一组数据或实现，优先考虑组合。

## 动手练习

1. 增加 `Triangle` 派生类，实现 `name()` 和 `area()`，并加入形状容器。
2. 增加一个打印周长的虚函数，让每种形状提供自己的实现。
3. 尝试直接创建 `Shape` 对象，观察纯虚函数如何使基类保持抽象。

## 简化说明

- 本课使用单一公有继承和纯虚接口，不讨论多重继承、虚继承、RTTI 或协变返回类型。
- 面积计算采用简化公式；重点是通过统一接口调用不同实现，不讨论几何数值精度。
- 示例使用智能指针持有多态对象，不手动调用 `new`/`delete`。

## 参考资料

- [C++ 工作草案：虚函数与动态派发](https://eel.is/c++draft/class.virtual)
- [C++ 工作草案：析构函数](https://eel.is/c++draft/class.dtor)
- [C++ Core Guidelines：C.120、C.121、C.127（继承层级、抽象接口与虚析构）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
