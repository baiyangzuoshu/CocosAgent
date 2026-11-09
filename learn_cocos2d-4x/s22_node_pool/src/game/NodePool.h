#pragma once

#include "../cocos/2d/CCNode.h"
#include <vector>

namespace cocos2d {
class NodePool {
public:
    ~NodePool();
    void put(Node* node);
    Node* get();
    unsigned int size() const { return static_cast<unsigned int>(_nodes.size()); }
    void clear();

private:
    std::vector<Node*> _nodes;
};
} // namespace cocos2d
