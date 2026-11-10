#pragma once

#include <vector>
#include "cocos/2d/CCAction.h"

namespace cocos2d {

class Node;

class ActionManager {
public:
        void addAction(Action* action, Node* target);
    void update(float dt);

private:
    struct Entry { Node* target; Action* action; };
    std::vector<Entry> _entries;
};

} // namespace cocos2d
