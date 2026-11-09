#pragma once

#include "../cocoa/CCObject.h"
#include <functional>
#include <string>
#include <vector>

namespace cocos2d {
class CCNode : public CCObject {
public:
    explicit CCNode(std::string name);
    ~CCNode() override;
    void addChild(CCNode* child);
    void removeChild(CCNode* child, bool cleanup = true);
    void cleanup();
    void onEnter();
    void onExit();
    void resumeSchedulerAndActions();
    void pauseSchedulerAndActions();
    void scheduleUpdate(std::function<void()> callback);
    void stepScheduledUpdate();
    bool schedulerPaused() const { return _schedulerPaused; }
    CCNode* getParent() const { return _parent; }

private:
    std::string _name;
    CCNode* _parent = nullptr;
    bool _running = false;
    bool _schedulerPaused = true;
    std::function<void()> _scheduledUpdate;
    std::vector<CCNode*> _children;
};
} // namespace cocos2d
