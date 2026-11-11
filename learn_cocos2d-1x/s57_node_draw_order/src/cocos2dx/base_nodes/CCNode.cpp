#include "../include/CCNode.h"

#include <iostream>

CCNode::CCNode(const std::string& name, int zOrder, bool visible)
    : _name(name), _zOrder(zOrder), _visible(visible) {}

void CCNode::addChild(CCNode* child, int zOrder) {
    child->_zOrder = zOrder;
    std::vector<CCNode*>::iterator position = _children.begin();
    while (position != _children.end() && (*position)->_zOrder <= zOrder) ++position;
    _children.insert(position, child);
}

void CCNode::draw() const {
    std::cout << "draw " << _name << "\n";
}

void CCNode::visit() const {
    if (!_visible) return;

    std::size_t childIndex = 0;
    while (childIndex < _children.size() && _children[childIndex]->_zOrder < 0) {
        _children[childIndex++]->visit();
    }

    draw();

    while (childIndex < _children.size()) {
        _children[childIndex++]->visit();
    }
}
