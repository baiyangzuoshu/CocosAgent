#include "cocos/2d/CCActionInterval.h"
#include "cocos/2d/CCNode.h"

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

MoveBy::MoveBy(float duration, float deltaX)
    : ActionInterval(duration), _deltaX(deltaX) {
}

void MoveBy::startWithTarget(Node* target) {
    ActionInterval::startWithTarget(target);
    _startX = target->getPositionX();
}

void MoveBy::update(float progress) {
    if (_target) {
        _target->setPositionX(_startX + _deltaX * progress);
    }
}

MoveTo::MoveTo(float duration, float endX)
    : MoveBy(duration, 0.0f), _endX(endX) {
}

void MoveTo::startWithTarget(Node* target) {
    MoveBy::startWithTarget(target);
    _deltaX = _endX - target->getPositionX();
}

} // namespace cocos2d
