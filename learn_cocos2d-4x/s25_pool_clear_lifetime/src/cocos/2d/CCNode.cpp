#include "CCNode.h"
#include <algorithm>
#include <cassert>
#include <iostream>
#include <utility>

namespace cocos2d {
Node::Node(std::string name) : _name(std::move(name)) {}

Node::~Node() {
    std::cout << "~" << _name << " (reference count reached zero)\n";
    for (auto* child : _children) {
        child->_parent = nullptr;
        child->release();
    }
}

void Node::addChild(Node* child) {
    assert(child && !child->_parent);
    child->retain(); // the parent owns one reference through its child list
    child->_parent = this;
    _children.push_back(child);
    if (_running) child->onEnter();
}

void Node::removeChild(Node* child, bool doCleanup) {
    auto it = std::find(_children.begin(), _children.end(), child);
    if (it == _children.end()) return;
    if (_running) child->onExit();
    if (doCleanup) child->cleanup();
    child->_parent = nullptr;
    _children.erase(it);
    child->release(); // removing the list entry releases the parent's reference
}

void Node::cleanup() {
    std::cout << _name << ".cleanup (stop actions and schedules)\n";
    for (auto* child : _children) child->cleanup();
}

void Node::onEnter() {
    if (_running) return;
    _running = true;
    std::cout << _name << ".onEnter\n";
    for (auto* child : _children) child->onEnter();
}

void Node::onExit() {
    if (!_running) return;
    std::cout << _name << ".onExit\n";
    _running = false;
    for (auto* child : _children) child->onExit();
}
} // namespace cocos2d
