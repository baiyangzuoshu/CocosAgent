#include "cocos2dx/actions/CCActionInstant.h"

#include <utility>

namespace cocos2d {

CCActionInstant::CCActionInstant()
    : CCFiniteTimeAction(0.0f) {
}

void CCActionInstant::step(float) {
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

void CCCallFunc::update(float progress) {
    CCActionInstant::update(progress);
    if (_callback) _callback();
}

} // namespace cocos2d
