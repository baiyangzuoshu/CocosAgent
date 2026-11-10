#pragma once

#include "../cocos/2d/CCNode.h"
#include <vector>

namespace cocos2d {
class PoolHandler {
public:
    virtual ~PoolHandler() = default;
    virtual void unuse(Node* node) = 0;
    virtual void reuse(Node* node, int hp) = 0;
};

class NodePool {
public:
    explicit NodePool(PoolHandler* handler) : _handler(handler) {}
    ~NodePool();
    bool put(Node* node);
    Node* get(int hp = 100);
    unsigned int size() const { return static_cast<unsigned int>(_nodes.size()); }
    bool isDisposed() const { return _disposed; }
    void clear();
    void dispose();

private:
    PoolHandler* _handler; // non-owning; the handler must outlive the pool
    bool _disposed = false;
    std::vector<Node*> _nodes;
};
} // namespace cocos2d
