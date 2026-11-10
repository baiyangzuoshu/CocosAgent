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

void CCActionInterval::step(ccTime dt) {
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

CCDelayTime::CCDelayTime(float duration)
    : CCActionInterval(duration) {
}

void CCDelayTime::update(float) {
    // DelayTime consumes time without modifying the target.
}

CCSequence::CCSequence(CCFiniteTimeAction* first, CCFiniteTimeAction* second)
    : CCActionInterval(first->getDuration() + second->getDuration()),
      _first(first),
      _second(second),
      _split(first->getDuration() / getDuration()) {
}

void CCSequence::startWithTarget(CCNode* target) {
    CCActionInterval::startWithTarget(target);
    _last = -1;
}

void CCSequence::update(float progress) {
    if (_target == nullptr) return;

    int found = 0;
    float localProgress = 0.0f;
    if (progress < _split) {
        localProgress = _split == 0.0f ? 1.0f : progress / _split;
    } else {
        found = 1;
        localProgress = _split == 1.0f ? 1.0f : (progress - _split) / (1.0f - _split);
        if (_last == -1) {
            _first->startWithTarget(_target);
            _first->update(1.0f);
        } else if (_last == 0) {
            _first->update(1.0f);
        }
    }

    CCFiniteTimeAction* action = found == 0 ? _first : _second;
    if (_last == found && action->isDone()) return;
    if (_last != found) action->startWithTarget(_target);
    action->update(std::max(0.0f, std::min(1.0f, localProgress)));
    _last = found;
}

CCSpawn::CCSpawn(CCFiniteTimeAction* first, CCFiniteTimeAction* second)
    : CCActionInterval(std::max(first->getDuration(), second->getDuration())),
      _first(first),
      _second(second) {
    if (first->getDuration() < getDuration()) {
        _firstDelay.reset(new CCDelayTime(getDuration() - first->getDuration()));
        _firstPadding.reset(new CCSequence(first, _firstDelay.get()));
        _first = _firstPadding.get();
    }
    if (second->getDuration() < getDuration()) {
        _secondDelay.reset(new CCDelayTime(getDuration() - second->getDuration()));
        _secondPadding.reset(new CCSequence(second, _secondDelay.get()));
        _second = _secondPadding.get();
    }
}

void CCSpawn::startWithTarget(CCNode* target) {
    CCActionInterval::startWithTarget(target);
    _first->startWithTarget(target);
    _second->startWithTarget(target);
}

void CCSpawn::update(float progress) {
    _first->update(progress);
    _second->update(progress);
}

} // namespace cocos2d
