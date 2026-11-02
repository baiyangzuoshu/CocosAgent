#include "cocos/2d/CCNode.h"

#include <iostream>
#include <stdexcept>

namespace cocos2d {

Node::Node(int tag)
: _tag(tag), _running(false), _parent(nullptr) {
}

Node::~Node() = default;

void Node::addChild(Node* child) {
    if (!child || child->_parent) {
        throw std::logic_error("child must be unattached");
    }
    _children.push_back(child);
    child->setParent(this);
}

void Node::onEnter() {
    std::cout << "Node.onEnter tag=" << _tag << '\n';
    for (auto* child : _children) {
        child->onEnter();
    }
    _running = true;
}

void Node::onExit() {
    std::cout << "Node.onExit tag=" << _tag << '\n';
    _running = false;
    for (auto* child : _children) {
        child->onExit();
    }
}

void Node::setTag(int tag) { _tag = tag; }
int Node::getTag() const { return _tag; }
Node* Node::getParent() const { return _parent; }
const std::vector<Node*>& Node::getChildren() const { return _children; }
void Node::setParent(Node* parent) { _parent = parent; }

} // namespace cocos2d
