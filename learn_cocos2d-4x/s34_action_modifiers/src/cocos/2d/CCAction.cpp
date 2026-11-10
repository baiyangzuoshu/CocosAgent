#include "cocos/2d/CCAction.h"

#include <algorithm>
#include <limits>

namespace cocos2d {

void Action::startWithTarget(Node* target) {
    _target = target;
}

FiniteTimeAction::FiniteTimeAction(float duration)
    : _duration(std::max(duration, 0.0f)) {
}

float FiniteTimeAction::getDuration() const {
    return _duration;
}

} // namespace cocos2d
