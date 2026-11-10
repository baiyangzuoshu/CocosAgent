#include "cocos/2d/CCActionInterval.h"
#include <algorithm>
#include <limits>

namespace cocos2d {

ActionInterval::ActionInterval(float duration)
    : _duration(duration > 0.0f ? duration : std::numeric_limits<float>::epsilon()) {
}

void ActionInterval::startWithTarget(Node* target) {
    Action::startWithTarget(target);
    _elapsed = 0.0f;
    _firstTick = true;
}

void ActionInterval::step(float dt) {
    if (_firstTick) {
        _firstTick = false;
        _elapsed = 0.0f;
    } else {
        _elapsed += dt;
    }
    const float progress = std::max(0.0f, std::min(1.0f, _elapsed / _duration));
    update(progress);
}

bool ActionInterval::isDone() const {
    return _elapsed >= _duration;
}

float ActionInterval::progress() const {
    return std::max(0.0f, std::min(1.0f, _elapsed / _duration));
}

DelayTime::DelayTime(float duration)
    : ActionInterval(duration) {
}

void DelayTime::update(float) {
    // DelayTime only waits; it does not modify the target.
}

} // namespace cocos2d
