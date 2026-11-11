#include "CCNode.h"

#include <iostream>

CCNode::CCNode(std::string name) : _name(std::move(name)) {}

void CCNode::addChild(CCNode* child) {
    _children.push_back(child);
}

void CCNode::draw() {}

void CCNode::visit() {
    std::cout << "CCNode::visit " << _name << "\n";
    draw();
    for (CCNode* child : _children) child->visit();
}
