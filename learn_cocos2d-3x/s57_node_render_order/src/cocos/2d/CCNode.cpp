#include "CCNode.h"

#include "CCCamera.h"
#include "../renderer/CCRenderer.h"

#include <algorithm>
#include <iostream>

namespace cocos2d {
unsigned int Node::s_nextArrival = 0;

Node::Node(std::string name, int localZOrder, bool visible,
           unsigned short cameraMask, float globalZOrder)
    : _name(std::move(name)), _localZOrder(localZOrder), _visible(visible),
      _cameraMask(cameraMask), _globalZOrder(globalZOrder),
      _orderOfArrival(s_nextArrival++) {}

void Node::addChild(Node* child) {
    child->_orderOfArrival = s_nextArrival++;
    _children.push_back(child);
    _childrenDirty = true;
}

void Node::sortAllChildren() {
    if (!_childrenDirty) return;
    std::stable_sort(_children.begin(), _children.end(), [](Node* a, Node* b) {
        if (a->_localZOrder != b->_localZOrder) return a->_localZOrder < b->_localZOrder;
        return a->_orderOfArrival < b->_orderOfArrival;
    });
    _childrenDirty = false;
}

void Node::visit(const Camera& camera, Renderer& renderer) {
    if (!_visible) {
        std::cout << "skip invisible subtree " << _name << "\n";
        return;
    }
    sortAllChildren();

    std::size_t childIndex = 0;
    while (childIndex < _children.size() && _children[childIndex]->_localZOrder < 0) {
        _children[childIndex++]->visit(camera, renderer);
    }

    if ((camera.getCameraFlag() & _cameraMask) != 0) {
        renderer.addCommand(_name, _globalZOrder);
    } else {
        std::cout << "camera mask skips draw " << _name << "\n";
    }

    while (childIndex < _children.size()) _children[childIndex++]->visit(camera, renderer);
}
}
