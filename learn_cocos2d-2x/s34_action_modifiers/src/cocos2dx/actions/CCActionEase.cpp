#include "cocos2dx/actions/CCActionEase.h"

#include <cmath>

namespace cocos2d {

CCActionEase::CCActionEase(CCActionInterval* innerAction)
    : CCActionInterval(innerAction->getDuration()),
      _innerAction(innerAction) {
}

void CCActionEase::startWithTarget(CCNode* target) {
    CCActionInterval::startWithTarget(target);
    _innerAction->startWithTarget(target);
}

CCEaseIn::CCEaseIn(CCActionInterval* innerAction, float rate)
    : CCActionEase(innerAction),
      _rate(rate) {
}

void CCEaseIn::update(float progress) {
    _innerAction->update(std::pow(progress, _rate));
}

} // namespace cocos2d
