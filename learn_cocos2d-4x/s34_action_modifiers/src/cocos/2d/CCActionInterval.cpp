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

Repeat::Repeat(ActionInterval* innerAction, unsigned int times)
    : ActionInterval(innerAction->getDuration() * std::max(1u, times)),
      _innerAction(innerAction),
      _times(std::max(1u, times)) {
}

void Repeat::startWithTarget(Node* target) {
    ActionInterval::startWithTarget(target);
    _iteration = 0;
    _innerAction->startWithTarget(target);
}

void Repeat::update(float progress) {
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

unsigned int Repeat::currentIteration() const {
    return _iteration + 1;
}

ReverseTime::ReverseTime(ActionInterval* innerAction)
    : ActionInterval(innerAction->getDuration()),
      _innerAction(innerAction) {
}

void ReverseTime::startWithTarget(Node* target) {
    ActionInterval::startWithTarget(target);
    _innerAction->startWithTarget(target);
}

void ReverseTime::update(float progress) {
    _innerAction->update(1.0f - progress);
}

} // namespace cocos2d
