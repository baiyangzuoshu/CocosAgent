#include "CCNode.h"

namespace cocos2d {
bool Node::addComponent(Component* component) {
    _updateScheduled = true; // 源码先 scheduleUpdate，再加入容器。
    return _components.add(component);
}

bool Node::removeComponent(Component* component) {
    return _components.remove(component);
}

void Node::onEnter() {
    _components.onEnter();
}

void Node::onExit() {
    _components.onExit();
}

void Node::update(float delta) {
    if (_updateScheduled) _components.visit(delta);
}
} // namespace cocos2d
