#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/actions/CCActionManager.h"

namespace cocos2d {

CCNode::CCNode(CCActionManager* actionManager)
    : _actionManager(actionManager) {
}

CCAction* CCNode::runAction(CCAction* action) {
    _actionManager->addAction(action, this);
    return action;
}

float CCNode::getPositionX() const {
    return _positionX;
}

void CCNode::setPositionX(float x) {
    _positionX = x;
}

} // namespace cocos2d
