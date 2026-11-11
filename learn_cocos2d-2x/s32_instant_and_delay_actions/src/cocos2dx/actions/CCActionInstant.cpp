#include "cocos2dx/actions/CCActionInstant.h"

namespace cocos2d {

void CCActionInstant::step(float) {
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

void CCCallFunc::update(float) {
    if (_callback) _callback();
}

} // namespace cocos2d
