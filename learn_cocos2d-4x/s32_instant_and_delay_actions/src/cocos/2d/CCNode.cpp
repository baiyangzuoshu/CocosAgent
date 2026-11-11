#include "cocos/2d/CCNode.h"
#include "cocos/2d/CCActionManager.h"

namespace cocos2d {

Node::Node(ActionManager* actionManager)
    : _actionManager(actionManager) {
}

Action* Node::runAction(Action* action) {
    _actionManager->addAction(action, this);
    return action;
}

float Node::getPositionX() const {
    return _positionX;
}

void Node::setPositionX(float x) {
    _positionX = x;
}

} // namespace cocos2d
