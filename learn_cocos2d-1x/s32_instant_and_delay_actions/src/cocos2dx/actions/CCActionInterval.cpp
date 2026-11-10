#include "cocos2dx/actions/CCActionInterval.h"
#include <algorithm>
#include <limits>

namespace cocos2d {

CCActionInterval::CCActionInterval(float duration)
    : _duration(duration > 0.0f ? duration : std::numeric_limits<float>::epsilon()) {
}

void CCActionInterval::startWithTarget(CCNode* target) {
    CCAction::startWithTarget(target);
    _elapsed = 0.0f;
    _firstTick = true;
}

void CCActionInterval::step(ccTime dt) {
    if (_firstTick) {
        _firstTick = false;
        _elapsed = 0.0f;
    } else {
        _elapsed += dt;
    }
    const float progress = std::max(0.0f, std::min(1.0f, _elapsed / _duration));
    update(progress);
}

bool CCActionInterval::isDone() const {
    return _elapsed >= _duration;
}

float CCActionInterval::progress() const {
    return std::max(0.0f, std::min(1.0f, _elapsed / _duration));
}

CCDelayTime::CCDelayTime(float duration)
    : CCActionInterval(duration) {
}

void CCDelayTime::update(float) {
    // DelayTime only waits; it does not modify the target.
}

} // namespace cocos2d
