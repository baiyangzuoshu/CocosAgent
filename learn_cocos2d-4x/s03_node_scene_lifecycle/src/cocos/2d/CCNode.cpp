#include "cocos/2d/CCNode.h"

#include <iostream>
#include <stdexcept>

namespace cocos2d {

Node::Node(const std::string& name)
: _name(name), _running(false), _parent(nullptr) {
}

Node::~Node() = default;

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
    child->setParent(this);
}

void Node::onEnter() {
    std::cout << _name << ".onEnter\n";
    for (auto* child : _children) {
        child->onEnter();
    }
    _running = true;
}

void Node::onExit() {
    std::cout << _name << ".onExit\n";
    _running = false;
    for (auto* child : _children) {
        child->onExit();
    }
}

const std::string& Node::getName() const { return _name; }
Node* Node::getParent() const { return _parent; }
bool Node::isRunning() const { return _running; }
void Node::setParent(Node* parent) { _parent = parent; }

} // namespace cocos2d
