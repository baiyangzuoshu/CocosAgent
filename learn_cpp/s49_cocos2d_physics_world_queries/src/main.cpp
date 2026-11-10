#include <algorithm>
#include <cmath>
#include <iostream>
#include <optional>
#include <vector>

struct Vec2
{
    double x;
    double y;
};
struct CircleShape
{
    int bodyTag;
    Vec2 center;
    double radius;
};
struct Rect
{
    double left;
    double bottom;
    double right;
    double top;
};
struct RayHit
{
    int bodyTag;
    double fraction;
    Vec2 point;
};
std::optional<RayHit> rayCircle(const CircleShape& circle, Vec2 start, Vec2 end)
{
    const Vec2 direction{end.x - start.x, end.y - start.y};
    const Vec2 offset{start.x - circle.center.x, start.y - circle.center.y};
    const double a = direction.x * direction.x + direction.y * direction.y;
    const double b = 2.0 * (offset.x * direction.x + offset.y * direction.y);
    const double c = offset.x * offset.x + offset.y * offset.y
        - circle.radius * circle.radius;
    const double discriminant = b * b - 4.0 * a * c;
    if (discriminant < 0.0 || a == 0.0)
        return std::nullopt;
    const double fraction = (-b - std::sqrt(discriminant)) / (2.0 * a);
    if (fraction < 0.0 || fraction > 1.0)
        return std::nullopt;
    return RayHit{circle.bodyTag, fraction,
                  {start.x + fraction * direction.x,
                   start.y + fraction * direction.y}};
}
bool contains(const CircleShape& circle, Vec2 point)
{
    const double dx = point.x - circle.center.x;
    const double dy = point.y - circle.center.y;
    return dx * dx + dy * dy <= circle.radius * circle.radius;
}
bool aabbOverlaps(const CircleShape& circle, const Rect& rect)
{
    return circle.center.x + circle.radius >= rect.left
        && circle.center.x - circle.radius <= rect.right
        && circle.center.y + circle.radius >= rect.bottom
        && circle.center.y - circle.radius <= rect.top;
}
int main()
{
    const std::vector<CircleShape> shapes{
        {10, {5.0, 0.0}, 1.0},
        {20, {9.0, 0.0}, 1.0}};
    std::vector<RayHit> hits;
    for (const auto& shape : shapes)
    {
        if (auto hit = rayCircle(shape, {0.0, 0.0}, {12.0, 0.0}))
            hits.push_back(*hit);
    }
    std::sort(hits.begin(), hits.end(),
              [](const RayHit& a, const RayHit& b) {
                  return a.fraction < b.fraction;
              });
    if (!hits.empty())
        std::cout << "nearest ray hit body=" << hits.front().bodyTag
                  << ", fraction=" << hits.front().fraction
                  << ", x=" << hits.front().point.x << '\n';
    std::cout << "point query at (5, 0):";
    for (const auto& shape : shapes)
        if (contains(shape, {5.0, 0.0}))
            std::cout << ' ' << shape.bodyTag;
    std::cout << '\n';
    const Rect corner{4.0, 0.9, 4.1, 1.0};
    std::cout << "rectangle AABB candidates:";
    for (const auto& shape : shapes)
        if (aabbOverlaps(shape, corner))
            std::cout << ' ' << shape.bodyTag;
    std::cout << " (broad-phase candidates, not exact shape overlap)\n";
}
