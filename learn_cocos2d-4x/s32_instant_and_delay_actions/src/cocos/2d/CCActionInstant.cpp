#include "cocos/2d/CCActionInstant.h"

namespace cocos2d {

void ActionInstant::startWithTarget(Node* target) {
    Action::startWithTarget(target);
    _done = false;
}

void ActionInstant::step(float) {
    update(1.0f);
}

bool ActionInstant::isDone() const {
    return _done;
}

void ActionInstant::update(float) {
    _done = true;
}

CallFunc::CallFunc(std::function<void()> callback)
    : _callback(std::move(callback)) {
}

void CallFunc::update(float time) {
    ActionInstant::update(time);
    if (_callback) _callback();
}

} // namespace cocos2d
