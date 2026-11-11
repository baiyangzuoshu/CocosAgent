#include "cocos2dx/actions/CCActionInstant.h"

namespace cocos2d {

void CCActionInstant::step(ccTime) {
    update(1.0f);
}

bool CCActionInstant::isDone() const {
    return true;
}

void CCActionInstant::update(float) {
    // Base instant actions have no target-side effect.
}

CCCallFunc::CCCallFunc(std::function<void()> callback)
    : _callback(std::move(callback)) {
}

void CCCallFunc::startWithTarget(CCNode* target) {
    CCAction::startWithTarget(target);
    if (_callback) _callback(); // Cocos2d-x 1.x executes CallFunc synchronously here.
}

} // namespace cocos2d
