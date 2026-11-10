#include "NodePool.h"
#include <algorithm>

namespace cocos2d {
NodePool::~NodePool() { clear(); }

void NodePool::put(Node* node) {
    // Pointer identity prevents duplicate entries and duplicate pool retains.
    if (!node || std::find(_nodes.begin(), _nodes.end(), node) != _nodes.end()) return;
    node->retain();
    if (auto* parent = node->getParent()) parent->removeChild(node, false);
    _handler->unuse(node);
    _nodes.push_back(node);
}

Node* NodePool::get(int hp) {
    // vector 尾部保存最近入池的节点，back/pop_back 构成 LIFO。
    if (_nodes.empty()) return nullptr;
    Node* node = _nodes.back();
    _nodes.pop_back();
    _handler->reuse(node, hp);
    return node;
}

void NodePool::clear() {
    for (auto* node : _nodes) node->release();
    _nodes.clear();
}
} // namespace cocos2d
