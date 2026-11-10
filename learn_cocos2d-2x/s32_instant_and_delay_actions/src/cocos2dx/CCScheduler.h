#pragma once

namespace cocos2d {

class CCActionManager;

class CCScheduler {
public:
    void scheduleUpdateForTarget(CCActionManager* target);
    void update(float dt);

private:
    CCActionManager* _target = nullptr;
};

} // namespace cocos2d
