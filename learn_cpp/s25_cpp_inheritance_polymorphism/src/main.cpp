#include <iomanip>
#include <iostream>
#include <memory>
#include <vector>

constexpr double kPi = 3.14159265358979323846;

class Shape {
public:
    virtual ~Shape() = default;

    virtual const char* name() const = 0;
    virtual double area() const = 0;
};

class Rectangle : public Shape {
public:
    Rectangle(double width, double height)
        : width_{width}, height_{height}
    {
    }

    const char* name() const override
    {
        return "rectangle";
    }

    double area() const override
    {
        return width_ * height_;
    }

private:
    double width_;
    double height_;
};

class Circle : public Shape {
public:
    explicit Circle(double radius)
        : radius_{radius}
    {
    }

    const char* name() const override
    {
        return "circle";
    }

    double area() const override
    {
        return kPi * radius_ * radius_;
    }

private:
    double radius_;
};

void print_area(const Shape& shape)
{
    std::cout << shape.name() << ": " << shape.area() << '\n';
}

int main()
{
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Rectangle>(3.0, 4.0));
    shapes.push_back(std::make_unique<Circle>(2.0));

    std::cout << std::fixed << std::setprecision(2);
    for (const std::unique_ptr<Shape>& shape : shapes) {
        print_area(*shape);
    }

    return 0;
}
