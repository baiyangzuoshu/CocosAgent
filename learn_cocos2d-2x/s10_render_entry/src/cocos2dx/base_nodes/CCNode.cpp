#include "CCNode.h"
#include <algorithm>

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

void CCNode::addChild(CCNode* child, int zOrder) {
    child->_zOrder = zOrder;
    _children.push_back(child);
    std::stable_sort(_children.begin(), _children.end(), [](const CCNode* left, const CCNode* right) {
        return left->_zOrder < right->_zOrder;
    });
}

void CCNode::visit() {
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
