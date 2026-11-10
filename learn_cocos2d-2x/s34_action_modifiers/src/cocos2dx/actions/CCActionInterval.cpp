#include "cocos2dx/actions/CCActionInterval.h"

#include <algorithm>
#include <limits>

namespace cocos2d {

CCActionInterval::CCActionInterval(float duration)
    : CCFiniteTimeAction(std::max(duration, std::numeric_limits<float>::epsilon())) {
}

void CCActionInterval::startWithTarget(CCNode* target) {
    CCFiniteTimeAction::startWithTarget(target);
    _elapsed = 0.0f;
    _firstTick = true;
}

void CCActionInterval::step(float dt) {
    if (_firstTick) {
        _firstTick = false;
        _elapsed = 0.0f;
    } else {
        _elapsed += dt;
    }
    update(progress());
}

bool CCActionInterval::isDone() const {
    return !_firstTick && _elapsed >= getDuration();
}

float CCActionInterval::progress() const {
    return std::max(0.0f, std::min(1.0f, _elapsed / getDuration()));
}

CCRepeat::CCRepeat(CCActionInterval* innerAction, unsigned int times)
    : CCActionInterval(innerAction->getDuration() * std::max(1u, times)),
      _innerAction(innerAction),
      _times(std::max(1u, times)) {
}

void CCRepeat::startWithTarget(CCNode* target) {
    CCActionInterval::startWithTarget(target);
    _iteration = 0;
    _innerAction->startWithTarget(target);
}

void CCRepeat::update(float progress) {
    const float scaled = std::max(0.0f, std::min(1.0f, progress)) * _times;
    const unsigned int current = std::min(_times - 1, static_cast<unsigned int>(scaled));
    const float localProgress = progress >= 1.0f ? 1.0f : scaled - current;

    while (_iteration < current) {
        _innerAction->update(1.0f);
        ++_iteration;
        if (_iteration < _times) _innerAction->startWithTarget(_target);
    }
    _innerAction->update(localProgress);
}

unsigned int CCRepeat::currentIteration() const {
    return _iteration + 1;
}

CCReverseTime::CCReverseTime(CCActionInterval* innerAction)
    : CCActionInterval(innerAction->getDuration()),
      _innerAction(innerAction) {
}

void CCReverseTime::startWithTarget(CCNode* target) {
    CCActionInterval::startWithTarget(target);
    _innerAction->startWithTarget(target);
}

void CCReverseTime::update(float progress) {
    _innerAction->update(1.0f - progress);
}

} // namespace cocos2d
