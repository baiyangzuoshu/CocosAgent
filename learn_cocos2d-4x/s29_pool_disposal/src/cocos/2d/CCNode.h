#pragma once

#include "../base/CCRef.h"
#include <functional>
#include <string>
#include <vector>

namespace cocos2d {
class Node : public Ref {
public:
    explicit Node(std::string name);
    ~Node() override;
    void addChild(Node* child);
    void removeChild(Node* child, bool cleanup = true);
    void cleanup();
    void onEnter();
    void onExit();
    void resume();
    void pause();
    void scheduleUpdate(std::function<void()> callback);
    void stepScheduledUpdate();
    bool schedulerPaused() const { return _schedulerPaused; }
    Node* getParent() const { return _parent; }

private:
    std::string _name;
    Node* _parent = nullptr;
    bool _running = false;
    bool _schedulerPaused = true;
    std::function<void()> _scheduledUpdate;
    std::vector<Node*> _children;
};
} // namespace cocos2d
