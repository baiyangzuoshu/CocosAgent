#include "cocos2dx/include/CCNode.h"

#include <iostream>
#include <stdexcept>

namespace cocos2d {

CCNode::CCNode(int tag)
: _tag(tag), _running(false), _parent(nullptr) {
}

CCNode::~CCNode() = default;

void CCNode::addChild(CCNode* child) {
    if (!child || child->_parent) {
        throw std::logic_error("child must be unattached");
    }
    _children.push_back(child);
    child->setParent(this);
}

void CCNode::onEnter() {
    for (auto* child : _children) {
        child->onEnter();
    }
    _running = true;
    std::cout << "CCNode.onEnter tag=" << _tag << '\n';
}

void CCNode::onExit() {
    _running = false;
    std::cout << "CCNode.onExit tag=" << _tag << '\n';
    for (auto* child : _children) {
        child->onExit();
    }
}

void CCNode::setTag(int tag) { _tag = tag; }
int CCNode::getTag() const { return _tag; }
CCNode* CCNode::getParent() const { return _parent; }
const std::vector<CCNode*>& CCNode::getChildren() const { return _children; }
void CCNode::setParent(CCNode* parent) { _parent = parent; }

} // namespace cocos2d
