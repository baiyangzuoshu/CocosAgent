#pragma once

#include <vector>

namespace cocos2d {
class CCNode;

class CCScheduler {
public:
    static CCScheduler& sharedScheduler();
    void scheduleUpdateForTarget(CCNode* target);
    void tick(float delta);

private:
    std::vector<CCNode*> _targets;
};
} // namespace cocos2d
