#include "CCNode.h"
#include "../renderer/CCRenderer.h"
#include <algorithm>
#include <cassert>

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
    if (_running) return;
    _running = true;
    _components.onEnter();
    for (Node* child : _children) child->onEnter();
}

void Node::onExit() {
    if (!_running) return;
    _components.onExit();
    _running = false;
    for (Node* child : _children) child->onExit();
}

void Node::update(float delta) {
    _components.visit(delta);
}

void Node::addChild(Node* child, int zOrder) {
    assert(child && !child->_parent);
    child->_parent = this;
    child->_zOrder = zOrder;
    _children.push_back(child);
    if (_running) child->onEnter();
    std::stable_sort(_children.begin(), _children.end(), [](const Node* left, const Node* right) {
        return left->_zOrder < right->_zOrder;
    });
}

void Node::removeChild(Node* child, bool cleanup) {
    (void)cleanup; // 动作和调度清理不在本课范围。
    auto it = std::find(_children.begin(), _children.end(), child);
    if (it == _children.end()) return;
    if (_running) child->onExit();
    child->_parent = nullptr;
    _children.erase(it);
}

void Node::visit(Renderer& renderer) {
    for (Node* child : _children) {
        if (child->_zOrder < 0) child->visit(renderer);
        else break;
    }
    draw(renderer);
    for (Node* child : _children) {
        if (child->_zOrder >= 0) child->visit(renderer);
    }
}
} // namespace cocos2d
