#include "cocos2dx/actions/CCActionInterval.h"
#include "cocos2dx/base_nodes/CCNode.h"

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

void CCActionInterval::step(float dt) {
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

CCMoveBy::CCMoveBy(float duration, float deltaX)
    : CCActionInterval(duration), _deltaX(deltaX) {
}

void CCMoveBy::startWithTarget(CCNode* target) {
    CCActionInterval::startWithTarget(target);
    _startX = target->getPositionX();
}

void CCMoveBy::update(float progress) {
    if (_target) {
        _target->setPositionX(_startX + _deltaX * progress);
    }
}

CCMoveTo::CCMoveTo(float duration, float endX)
    : CCMoveBy(duration, 0.0f), _endX(endX) {
}

void CCMoveTo::startWithTarget(CCNode* target) {
    CCMoveBy::startWithTarget(target);
    _deltaX = _endX - target->getPositionX();
}

} // namespace cocos2d
