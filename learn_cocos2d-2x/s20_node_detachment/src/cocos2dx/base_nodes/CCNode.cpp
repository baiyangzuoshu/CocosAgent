#include "CCNode.h"
#include <algorithm>
#include <cassert>

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

void CCNode::onEnter() {
    if (_running) return;
    _running = true;
    for (CCNode* child : _children) child->onEnter();
}

void CCNode::onExit() {
    if (!_running) return;
    _running = false;
    for (CCNode* child : _children) child->onExit();
}

void CCNode::addChild(CCNode* child, int zOrder) {
    assert(child && !child->_parent);
    child->_parent = this;
    child->_zOrder = zOrder;
    _children.push_back(child);
    if (_running) child->onEnter();
    std::stable_sort(_children.begin(), _children.end(), [](const CCNode* left, const CCNode* right) {
        return left->_zOrder < right->_zOrder;
    });
}

void CCNode::removeChild(CCNode* child, bool cleanup) {
    (void)cleanup; // 动作和调度清理不在本课范围。
    auto it = std::find(_children.begin(), _children.end(), child);
    if (it == _children.end()) return;
    if (_running) child->onExit();
    child->_parent = nullptr;
    _children.erase(it);
}

void CCNode::visit() {
    if (!_visible) return;

    for (CCNode* child : _children) {
        if (child->_zOrder < 0) child->visit();
        else break;
    }
    draw();
    for (CCNode* child : _children) {
        if (child->_zOrder >= 0) child->visit();
    }
}
} // namespace cocos2d
