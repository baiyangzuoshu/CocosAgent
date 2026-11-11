#include "CCNode.h"

#include <iostream>

namespace cocos2d {
unsigned int CCNode::s_orderOfArrival = 0;

CCNode::CCNode(const std::string& name, int zOrder, bool visible)
    : _name(name), _zOrder(zOrder), _orderOfArrival(s_orderOfArrival++),
      _visible(visible), _reorderChildDirty(false) {}

void CCNode::addChild(CCNode* child, int zOrder) {
    child->_zOrder = zOrder;
    child->_orderOfArrival = s_orderOfArrival++;
    _children.push_back(child);
    _reorderChildDirty = true;
}

void CCNode::sortAllChildren() {
    if (!_reorderChildDirty) return;
    for (std::size_t i = 1; i < _children.size(); ++i) {
        CCNode* item = _children[i];
        std::size_t j = i;
        while (j > 0 && (item->_zOrder < _children[j - 1]->_zOrder
            || (item->_zOrder == _children[j - 1]->_zOrder
                && item->_orderOfArrival < _children[j - 1]->_orderOfArrival))) {
            _children[j] = _children[j - 1];
            --j;
        }
        _children[j] = item;
    }
    _reorderChildDirty = false;
}

void CCNode::draw() const {
    std::cout << "draw " << _name << "\n";
}

void CCNode::visit() {
    if (!_visible) return;
    if (!_children.empty()) sortAllChildren();

    std::size_t childIndex = 0;
    while (childIndex < _children.size() && _children[childIndex]->_zOrder < 0) {
        _children[childIndex++]->visit();
    }

    draw();

    while (childIndex < _children.size()) {
        _children[childIndex++]->visit();
    }
}
}
