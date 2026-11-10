#include <cmath>
#include <iomanip>
#include <iostream>
#include <stdexcept>

struct Vec2
{
    double x;
    double y;
};

struct Transform2D
{
    double a{1.0};
    double b{0.0};
    double c{0.0};
    double d{1.0};
    double tx{0.0};
    double ty{0.0};

    Vec2 apply(Vec2 point) const
    {
        return {a * point.x + c * point.y + tx,
                b * point.x + d * point.y + ty};
    }

    static Transform2D translation(double x, double y)
    {
        Transform2D result;
        result.tx = x;
        result.ty = y;
        return result;
    }

    static Transform2D rotation(double radians)
    {
        const double cosine = std::cos(radians);
        const double sine = std::sin(radians);
        return {cosine, sine, -sine, cosine, 0.0, 0.0};
    }

    static Transform2D scale(double x, double y)
    {
        return {x, 0.0, 0.0, y, 0.0, 0.0};
    }

    Transform2D inverse() const
    {
        const double determinant = a * d - b * c;
        if (std::abs(determinant) < 1e-12)
            throw std::runtime_error("non-invertible transform");

        Transform2D result{d / determinant, -b / determinant,
                           -c / determinant, a / determinant, 0.0, 0.0};
        result.tx = -(result.a * tx + result.c * ty);
        result.ty = -(result.b * tx + result.d * ty);
        return result;
    }
};

Transform2D operator*(const Transform2D& left, const Transform2D& right)
{
    return {
        left.a * right.a + left.c * right.b,
        left.b * right.a + left.d * right.b,
        left.a * right.c + left.c * right.d,
        left.b * right.c + left.d * right.d,
        left.a * right.tx + left.c * right.ty + left.tx,
        left.b * right.tx + left.d * right.ty + left.ty};
}

int main()
{
    constexpr double pi = 3.14159265358979323846;
    const Transform2D parent = Transform2D::translation(100.0, 50.0)
                             * Transform2D::rotation(pi / 2.0)
                             * Transform2D::scale(2.0, 2.0);
    const Transform2D child = Transform2D::translation(10.0, 0.0);
    const Transform2D childToWorld = parent * child;

    const Vec2 worldOrigin = childToWorld.apply({0.0, 0.0});
    const Vec2 worldPoint = childToWorld.apply({1.0, 0.0});
    const Vec2 localPoint = childToWorld.inverse().apply(worldPoint);

    std::cout << std::fixed << std::setprecision(2);
    std::cout << "child origin in world: (" << worldOrigin.x << ", "
              << worldOrigin.y << ")\n";
    std::cout << "world point converted back: (" << localPoint.x << ", "
              << localPoint.y << ")\n";
}
