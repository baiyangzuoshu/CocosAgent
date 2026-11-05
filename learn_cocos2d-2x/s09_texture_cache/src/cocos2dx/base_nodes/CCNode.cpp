#include "CCNode.h"

namespace cocos2d {
void CCNode::scheduleUpdate() {
    _scheduler->scheduleUpdateForTarget(this);
}

bool CCNode::addComponent(CCComponent* component) {
    return _components.add(component);
}

bool CCNode::removeComponent(CCComponent* component) {
    return _components.remove(component);
}

void CCNode::update(float delta) {
    _components.visit(delta);
}
} // namespace cocos2d
