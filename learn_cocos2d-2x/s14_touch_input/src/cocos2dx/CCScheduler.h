#pragma once

#include <vector>

namespace cocos2d {
class CCNode;

class CCScheduler {
public:
    void scheduleUpdateForTarget(CCNode* target);
    void update(float delta);

private:
    std::vector<CCNode*> _targets;
};
} // namespace cocos2d
