#include "NodePool.h"
#include <algorithm>

namespace cocos2d {
NodePool::~NodePool() { clear(); }

void NodePool::put(CCNode* node) {
    if (!node || std::find(_nodes.begin(), _nodes.end(), node) != _nodes.end()) return;
    node->retain(); // pool holds a reference before the parent drops its reference
    if (auto* parent = node->getParent()) parent->removeChild(node, false);
    _nodes.push_back(node);
}

CCNode* NodePool::get() {
    if (_nodes.empty()) return nullptr;
    CCNode* node = _nodes.back();
    _nodes.pop_back();
    return node; // transfer the pool's reference to the caller
}

void NodePool::clear() {
    for (auto* node : _nodes) node->release();
    _nodes.clear();
}
} // namespace cocos2d
