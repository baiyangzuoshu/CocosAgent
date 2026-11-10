#include "cocos2dx/actions/CCAction.h"

#include <algorithm>
#include <limits>

namespace cocos2d {

void CCAction::startWithTarget(CCNode* target) {
    _target = target;
}

CCFiniteTimeAction::CCFiniteTimeAction(float duration)
    : _duration(std::max(duration, 0.0f)) {
}

float CCFiniteTimeAction::getDuration() const {
    return _duration;
}

} // namespace cocos2d
