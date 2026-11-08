#pragma once

#include <vector>

namespace cocos2d {
class Node;

class Scheduler {
public:
    void scheduleUpdate(Node* target);
    void update(float delta);

private:
    std::vector<Node*> _targets;
};
} // namespace cocos2d
