#pragma once

#include "../cocos2dx/include/CCNode.h"
#include <vector>

namespace cocos2d {
class NodePool {
public:
    ~NodePool();
    void put(CCNode* node);
    CCNode* get();
    unsigned int size() const { return static_cast<unsigned int>(_nodes.size()); }
    void clear();

private:
    std::vector<CCNode*> _nodes;
};
} // namespace cocos2d
