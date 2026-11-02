#include "cocos2dx/include/CCNode.h"

#include <algorithm>
#include <stdexcept>

namespace cocos2d {

CCNode::CCNode()
: _parent(nullptr), _tag(0) {
}

CCNode::~CCNode() {
    for (auto* child : _children) {
        child->setParent(nullptr);
        child->release();
    }
}

CCNode* CCNode::node() {
    auto* node = new CCNode();
    node->autorelease();
    return node;
}

void CCNode::addChild(CCNode* child) {
    if (!child) {
        throw std::invalid_argument("child must not be null");
    }
    if (child->_parent) {
        throw std::logic_error("child already has a parent");
    }
    _children.push_back(child);
    child->retain();
    child->setParent(this);
}

void CCNode::removeChild(CCNode* child) {
    auto found = std::find(_children.begin(), _children.end(), child);
    if (found == _children.end()) {
        return;
    }
    child->setParent(nullptr);
    _children.erase(found);
    child->release();
}

CCNode* CCNode::getParent() const { return _parent; }
const std::vector<CCNode*>& CCNode::getChildren() const { return _children; }
void CCNode::setTag(int tag) { _tag = tag; }
int CCNode::getTag() const { return _tag; }
void CCNode::setPosition(float x, float y) {
    _position = CCPoint(x, y);
}

void CCNode::setPosition(const CCPoint& position) {
    _position = position;
}

const CCPoint& CCNode::getPosition() const {
    return _position;
}

void CCNode::setParent(CCNode* parent) { _parent = parent; }

} // namespace cocos2d
