#include "NodePool.h"
#include <algorithm>
#include <unordered_map>

namespace cocos2d {
namespace {
std::unordered_map<CCNode*, NodePool*>& poolOwners() {
    static std::unordered_map<CCNode*, NodePool*> owners;
    return owners;
}
} // namespace
NodePool::~NodePool() { clear(); }

bool NodePool::put(CCNode* node) {
    // This search only covers the current pool instance.
    // Pointer identity prevents duplicate entries and duplicate pool retains.
    if (!node || std::find(_nodes.begin(), _nodes.end(), node) != _nodes.end()) return false;
    auto& owners = poolOwners();
    // The shared registry rejects a node held by any other pool instance.
    if (owners.find(node) != owners.end()) return false;
    node->retain();
    owners[node] = this;
    if (auto* parent = node->getParent()) parent->removeChild(node, false);
    _handler->unuse(node);
    _nodes.push_back(node);
    return true;
}

CCNode* NodePool::get(int hp) {
    // vector 尾部保存最近入池的节点，back/pop_back 构成 LIFO。
    if (_nodes.empty()) return nullptr;
    CCNode* node = _nodes.back();
    _nodes.pop_back();
    auto& owners = poolOwners();
    auto owner = owners.find(node);
    if (owner != owners.end() && owner->second == this) owners.erase(owner);
    _handler->reuse(node, hp);
    return node;
}

void NodePool::clear() {
    auto& owners = poolOwners();
    for (auto* node : _nodes) {
        auto owner = owners.find(node);
        if (owner != owners.end() && owner->second == this) owners.erase(owner);
        node->release();
    }
    _nodes.clear();
}
} // namespace cocos2d
