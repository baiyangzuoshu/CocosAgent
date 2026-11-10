#include <cstdint>
#include <iostream>
#include <string>

struct Body
{
    std::string name;
    std::uint32_t category;
    std::uint32_t collisionMask;
    std::uint32_t contactTestMask;
};
bool collisionResponseEnabled(const Body& a, const Body& b)
{
    return (a.category & b.collisionMask) != 0
        && (b.category & a.collisionMask) != 0;
}
bool contactNotificationEnabled(const Body& a, const Body& b)
{
    return (a.category & b.contactTestMask) != 0
        && (b.category & a.contactTestMask) != 0;
}
void simulateContact(const Body& a, const Body& b)
{
    const bool response = collisionResponseEnabled(a, b);
    const bool notify = contactNotificationEnabled(a, b);
    std::cout << a.name << " / " << b.name
              << ": response=" << std::boolalpha << response
              << ", notification=" << notify;
    if (notify)
        std::cout << " -> onContactBegin";
    std::cout << '\n';
}
int main()
{
    constexpr std::uint32_t kGround = 1U << 0U;
    constexpr std::uint32_t kBall = 1U << 1U;
    Body ground{"ground", kGround, kBall, 0U};
    Body ball{"ball", kBall, kGround, kGround};
    std::cout << "one-sided contact-test mask:\n";
    simulateContact(ground, ball);
    ground.contactTestMask = kBall;
    std::cout << "both sides request contact notification:\n";
    simulateContact(ground, ball);
    ball.collisionMask = 0U;
    std::cout << "notification can be requested without collision response:\n";
    simulateContact(ground, ball);
}
