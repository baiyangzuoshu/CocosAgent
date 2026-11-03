#include "cocos/2d/CCAction.h"

namespace cocos2d {

void Action::startWithTarget(Node* target) {
    _target = target;
}

} // namespace cocos2d
