#pragma once

#include "../cocos2dx/include/CCNode.h"
#include <vector>

namespace cocos2d {
class PoolHandler {
public:
    virtual ~PoolHandler() = default;
    virtual void unuse(CCNode* node) = 0;
    virtual void reuse(CCNode* node, int hp) = 0;
};

class NodePool {
public:
    explicit NodePool(PoolHandler* handler) : _handler(handler) {}
    ~NodePool();
    bool put(CCNode* node);
    CCNode* get(int hp = 100);
    unsigned int size() const { return static_cast<unsigned int>(_nodes.size()); }
    void clear();

private:
    PoolHandler* _handler; // non-owning; the handler must outlive the pool
    std::vector<CCNode*> _nodes;
};
} // namespace cocos2d
