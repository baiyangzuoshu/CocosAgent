#pragma once

#include <vector>
#include "cocos2dx/actions/CCAction.h"

namespace cocos2d {

class CCNode;
class CCScheduler;

class CCActionManager {
public:
    explicit CCActionManager(CCScheduler* scheduler);
    void addAction(CCAction* action, CCNode* target);
    void update(ccTime dt);
    std::size_t runningActionCount() const;

private:
    bool init();
    CCScheduler* _scheduler;
    struct Entry { CCNode* target; CCAction* action; };
    std::vector<Entry> _entries;
};

} // namespace cocos2d
