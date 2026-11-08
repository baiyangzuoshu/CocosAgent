#include "../include/CCNode.h"
#include "../include/CCScheduler.h"
#include <algorithm>

namespace cocos2d {
void CCNode::schedule(SEL_SCHEDULE selector, float interval) {
    CCScheduler::sharedScheduler().scheduleSelector(this, selector, interval);
}

void CCNode::onTimer(float) {}

void CCNode::addChild(CCNode* child, int zOrder) {
    child->_zOrder = zOrder;
    _children.push_back(child);
    std::stable_sort(_children.begin(), _children.end(), [](const CCNode* left, const CCNode* right) {
        return left->_zOrder < right->_zOrder;
    });
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
