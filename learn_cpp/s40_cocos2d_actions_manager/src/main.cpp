#include <algorithm>
#include <functional>
#include <initializer_list>
#include <iostream>
#include <utility>
#include <vector>

struct NodeState
{
    double x{0.0};
    double y{0.0};
    double opacity{1.0};
};

enum class SegmentKind { MoveBy, FadeTo, Call };

struct Segment
{
    SegmentKind kind;
    double start{0.0};
    double duration{0.0};
    double first{0.0};
    double second{0.0};
    std::function<void()> callback;
    bool started{false};
    bool called{false};
    double fromX{0.0};
    double fromY{0.0};
    double fromOpacity{1.0};
};

struct ActionGroup
{
    std::vector<Segment> segments;
    double duration{0.0};
};

ActionGroup moveBy(double duration, double dx, double dy)
{
    Segment segment{};
    segment.kind = SegmentKind::MoveBy;
    segment.duration = duration;
    segment.first = dx;
    segment.second = dy;
    return {{std::move(segment)}, duration};
}

ActionGroup fadeTo(double duration, double opacity)
{
    Segment segment{};
    segment.kind = SegmentKind::FadeTo;
    segment.duration = duration;
    segment.first = opacity;
    return {{std::move(segment)}, duration};
}

ActionGroup call(std::function<void()> callback)
{
    Segment segment{};
    segment.kind = SegmentKind::Call;
    segment.callback = std::move(callback);
    return {{std::move(segment)}, 0.0};
}

ActionGroup sequence(std::initializer_list<ActionGroup> children)
{
    ActionGroup result;
    double offset = 0.0;
    for (const auto& child : children)
    {
        for (auto segment : child.segments)
        {
            segment.start += offset;
            result.segments.push_back(std::move(segment));
        }
        offset += child.duration;
    }
    result.duration = offset;
    return result;
}

ActionGroup spawn(std::initializer_list<ActionGroup> children)
{
    ActionGroup result;
    for (const auto& child : children)
    {
        result.duration = std::max(result.duration, child.duration);
        result.segments.insert(result.segments.end(),
                               child.segments.begin(), child.segments.end());
    }
    return result;
}

class ActionManager
{
public:
    void run(NodeState& target, ActionGroup action)
    {
        active_.push_back({&target, std::move(action), 0.0});
    }

    void update(double deltaTime)
    {
        for (auto& active : active_)
        {
            active.elapsed = std::min(active.elapsed + deltaTime,
                                      active.action.duration);
            for (auto& segment : active.action.segments)
            {
                if (active.elapsed < segment.start)
                    continue;

                if (segment.kind == SegmentKind::Call)
                {
                    if (!segment.called)
                    {
                        segment.called = true;
                        segment.callback();
                    }
                    continue;
                }

                if (!segment.started)
                {
                    segment.started = true;
                    segment.fromX = active.target->x;
                    segment.fromY = active.target->y;
                    segment.fromOpacity = active.target->opacity;
                }

                const double progress = segment.duration == 0.0
                    ? 1.0
                    : std::clamp((active.elapsed - segment.start) / segment.duration,
                                 0.0, 1.0);
                if (segment.kind == SegmentKind::MoveBy)
                {
                    active.target->x = segment.fromX + segment.first * progress;
                    active.target->y = segment.fromY + segment.second * progress;
                }
                else
                {
                    active.target->opacity = segment.fromOpacity
                        + (segment.first - segment.fromOpacity) * progress;
                }
            }
        }

        active_.erase(std::remove_if(active_.begin(), active_.end(),
            [](const Active& active) {
                return active.elapsed >= active.action.duration;
            }), active_.end());
    }

private:
    struct Active
    {
        NodeState* target;
        ActionGroup action;
        double elapsed;
    };
    std::vector<Active> active_;
};

int main()
{
    NodeState sprite;
    ActionManager manager;
    ActionGroup animation = sequence({
        moveBy(1.0, 40.0, 0.0),
        spawn({fadeTo(0.5, 0.4), moveBy(1.0, 0.0, 20.0)}),
        call([] { std::cout << "sequence complete\n"; })});
    manager.run(sprite, std::move(animation));

    for (int frame = 1; frame <= 4; ++frame)
    {
        manager.update(0.5);
        std::cout << "frame " << frame << ": position=(" << sprite.x << ", "
                  << sprite.y << "), opacity=" << sprite.opacity << '\n';
    }
}
