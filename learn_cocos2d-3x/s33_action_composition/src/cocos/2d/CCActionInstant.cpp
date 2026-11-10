#include "cocos/2d/CCActionInstant.h"

#include <utility>

namespace cocos2d {

ActionInstant::ActionInstant()
    : FiniteTimeAction(0.0f) {
}

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

void CallFunc::update(float progress) {
    ActionInstant::update(progress);
    if (_callback) _callback();
}

} // namespace cocos2d
