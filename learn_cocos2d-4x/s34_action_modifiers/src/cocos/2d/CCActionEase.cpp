#include "cocos/2d/CCActionEase.h"

#include <cmath>

namespace cocos2d {

ActionEase::ActionEase(ActionInterval* innerAction)
    : ActionInterval(innerAction->getDuration()),
      _innerAction(innerAction) {
}

void ActionEase::startWithTarget(Node* target) {
    ActionInterval::startWithTarget(target);
    _innerAction->startWithTarget(target);
}

EaseIn::EaseIn(ActionInterval* innerAction, float rate)
    : ActionEase(innerAction),
      _rate(rate) {
}

void EaseIn::update(float progress) {
    _innerAction->update(std::pow(progress, _rate));
}

} // namespace cocos2d
