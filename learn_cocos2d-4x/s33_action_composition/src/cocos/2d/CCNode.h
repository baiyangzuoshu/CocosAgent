#pragma once

namespace cocos2d {

class ActionManager;
class Action;

class Node {
public:
    explicit Node(ActionManager* actionManager);
    Action* runAction(Action* action);

private:
    ActionManager* _actionManager;
};

} // namespace cocos2d
