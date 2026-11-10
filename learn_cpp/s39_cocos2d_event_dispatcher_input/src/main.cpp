#include <algorithm>
#include <functional>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

struct Vec2
{
    double x;
    double y;
};

struct Rect
{
    double x;
    double y;
    double width;
    double height;

    bool contains(Vec2 point) const
    {
        return point.x >= x && point.x <= x + width
            && point.y >= y && point.y <= y + height;
    }
};

struct Listener
{
    int priority;
    std::string name;
    Vec2 worldOrigin;
    Rect localBounds;
    std::function<bool(Vec2)> onTouchBegan;
};

class EventDispatcher
{
public:
    void addListener(Listener listener)
    {
        listeners_.push_back(std::move(listener));
        std::stable_sort(listeners_.begin(), listeners_.end(),
            [](const Listener& a, const Listener& b) {
                return a.priority < b.priority;
            });
    }

    void dispatchTouchBegan(Vec2 worldPoint) const
    {
        for (const auto& listener : listeners_)
        {
            const Vec2 localPoint{worldPoint.x - listener.worldOrigin.x,
                                  worldPoint.y - listener.worldOrigin.y};
            std::cout << "try " << listener.name << " local=("
                      << localPoint.x << ", " << localPoint.y << ")\n";
            if (listener.onTouchBegan(localPoint))
            {
                std::cout << listener.name << " claims touch\n";
                return;
            }
        }
        std::cout << "touch not claimed\n";
    }

private:
    std::vector<Listener> listeners_;
};

Listener makeHitListener(int priority, std::string name,
                         Vec2 worldOrigin, Rect bounds)
{
    const std::string label = name;
    return {priority, std::move(name), worldOrigin, bounds,
        [label, bounds](Vec2 localPoint) {
            if (!bounds.contains(localPoint))
                return false;
            std::cout << "hit " << label << '\n';
            return true;
        }};
}

int main()
{
    EventDispatcher dispatcher;
    dispatcher.addListener(makeHitListener(0, "Button", {0.0, 0.0},
                                           {0.0, 0.0, 100.0, 50.0}));
    dispatcher.addListener(makeHitListener(10, "Player", {150.0, 100.0},
                                           {-20.0, -20.0, 40.0, 40.0}));

    std::cout << "outside touch:\n";
    dispatcher.dispatchTouchBegan({120.0, 80.0});
    std::cout << "player touch:\n";
    dispatcher.dispatchTouchBegan({155.0, 105.0});
}
