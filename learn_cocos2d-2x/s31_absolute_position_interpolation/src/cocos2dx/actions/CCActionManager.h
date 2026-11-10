#pragma once

#include <vector>
#include "cocos2dx/actions/CCAction.h"

namespace cocos2d {

class CCNode;

class CCActionManager {
public:
        void addAction(CCAction* action, CCNode* target);
    void update(float dt);

private:
    struct Entry { CCNode* target; CCAction* action; };
    std::vector<Entry> _entries;
};

} // namespace cocos2d
