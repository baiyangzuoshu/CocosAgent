#include "cocos2dx/actions/CCAction.h"

namespace cocos2d {

void CCAction::startWithTarget(CCNode* target) {
    _target = target;
}

} // namespace cocos2d
