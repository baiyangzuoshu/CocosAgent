#include "cocos/2d/CCNode.h"

#include <algorithm>
#include <stdexcept>

namespace cocos2d {

Node::Node()
: _parent(nullptr) {
}

Node::~Node() {
    for (auto* child : _children) {
        child->setParent(nullptr);
        child->release();
    }
}

Node* Node::create() {
    auto* node = new Node();
    node->autorelease();
    return node;
}

void Node::addChild(Node* child) {
    if (!child) {
        throw std::invalid_argument("child must not be null");
    }
    if (child->_parent) {
        throw std::logic_error("child already has a parent");
    }

    for (auto* ancestor = this; ancestor; ancestor = ancestor->_parent) {
        if (ancestor == child) {
            throw std::logic_error("a node cannot be added below its descendant");
        }
    }

    _children.push_back(child);
    child->retain();
    child->setParent(this);
}

void Node::removeChild(Node* child) {
    auto found = std::find(_children.begin(), _children.end(), child);
    if (found == _children.end()) {
        return;
    }

    child->setParent(nullptr);
    _children.erase(found);
    child->release();
}

Node* Node::getParent() const {
    return _parent;
}

const std::vector<Node*>& Node::getChildren() const {
    return _children;
}

const std::string& Node::getName() const {
    return _name;
}

void Node::setName(const std::string& name) {
    _name = name;
}

void Node::setParent(Node* parent) {
    _parent = parent;
}

} // namespace cocos2d
