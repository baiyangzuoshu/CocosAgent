#include "CCNode.h"

namespace cocos2d {
void Node::scheduleUpdate() {
    _scheduler->scheduleUpdate(this);
}

bool Node::addComponent(Component* component) {
    scheduleUpdate(); // 3.x/4.x 在挂载组件时自动注册 Node 更新。
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
    _components.visit(delta);
}
} // namespace cocos2d
