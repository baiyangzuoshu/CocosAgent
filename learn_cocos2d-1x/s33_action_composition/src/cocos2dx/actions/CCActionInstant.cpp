#include "cocos2dx/actions/CCActionInstant.h"

#include <utility>

namespace cocos2d {

CCActionInstant::CCActionInstant()
    : CCFiniteTimeAction(0.0f) {
}

void CCActionInstant::step(ccTime) {
    update(1.0f);
}

bool CCActionInstant::isDone() const {
    return true;
}

void CCActionInstant::update(float) {
}

CCCallFunc::CCCallFunc(std::function<void()> callback)
    : _callback(std::move(callback)) {
}
void CCCallFunc::startWithTarget(CCNode* target) {
    CCAction::startWithTarget(target);
    if (_callback) _callback(); // Cocos2d-x 1.x invokes CallFunc when the child starts.
}


} // namespace cocos2d
