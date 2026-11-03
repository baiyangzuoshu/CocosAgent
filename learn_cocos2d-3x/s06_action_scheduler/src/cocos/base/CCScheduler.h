#pragma once

namespace cocos2d {

class ActionManager;

class Scheduler {
public:
    void scheduleUpdateForTarget(ActionManager* target);
    void update(float dt);

private:
    ActionManager* _target = nullptr;
};

} // namespace cocos2d
