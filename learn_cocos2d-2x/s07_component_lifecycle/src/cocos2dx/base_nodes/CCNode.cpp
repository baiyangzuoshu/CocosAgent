#include "CCNode.h"

namespace cocos2d {
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
