#include "cocos/2d/CCActionInterval.h"

#include <algorithm>
#include <limits>

namespace cocos2d {

ActionInterval::ActionInterval(float duration)
    : FiniteTimeAction(std::max(duration, std::numeric_limits<float>::epsilon())) {
}

void ActionInterval::startWithTarget(Node* target) {
    FiniteTimeAction::startWithTarget(target);
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
    update(progress());
}

bool ActionInterval::isDone() const {
    return !_firstTick && _elapsed >= getDuration();
}

float ActionInterval::progress() const {
    return std::max(0.0f, std::min(1.0f, _elapsed / getDuration()));
}

DelayTime::DelayTime(float duration)
    : ActionInterval(duration) {
}

void DelayTime::update(float) {
    // DelayTime consumes time without modifying the target.
}

Sequence::Sequence(FiniteTimeAction* first, FiniteTimeAction* second)
    : ActionInterval(first->getDuration() + second->getDuration()),
      _first(first),
      _second(second),
      _split(first->getDuration() / getDuration()) {
}

void Sequence::startWithTarget(Node* target) {
    ActionInterval::startWithTarget(target);
    _last = -1;
}

void Sequence::update(float progress) {
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

    FiniteTimeAction* action = found == 0 ? _first : _second;
    if (_last == found && action->isDone()) return;
    if (_last != found) action->startWithTarget(_target);
    action->update(std::max(0.0f, std::min(1.0f, localProgress)));
    _last = found;
}

Spawn::Spawn(FiniteTimeAction* first, FiniteTimeAction* second)
    : ActionInterval(std::max(first->getDuration(), second->getDuration())),
      _first(first),
      _second(second) {
    if (first->getDuration() < getDuration()) {
        _firstDelay.reset(new DelayTime(getDuration() - first->getDuration()));
        _firstPadding.reset(new Sequence(first, _firstDelay.get()));
        _first = _firstPadding.get();
    }
    if (second->getDuration() < getDuration()) {
        _secondDelay.reset(new DelayTime(getDuration() - second->getDuration()));
        _secondPadding.reset(new Sequence(second, _secondDelay.get()));
        _second = _secondPadding.get();
    }
}

void Spawn::startWithTarget(Node* target) {
    ActionInterval::startWithTarget(target);
    _first->startWithTarget(target);
    _second->startWithTarget(target);
}

void Spawn::update(float progress) {
    _first->update(progress);
    _second->update(progress);
}

} // namespace cocos2d
