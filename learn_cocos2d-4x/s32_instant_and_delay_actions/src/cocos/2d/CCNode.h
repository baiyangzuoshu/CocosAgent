#pragma once

namespace cocos2d {

class ActionManager;
class Action;

class Node {
public:
    explicit Node(ActionManager* actionManager);
    Action* runAction(Action* action);
    float getPositionX() const;
    void setPositionX(float x);

private:
    ActionManager* _actionManager;
    float _positionX = 0.0f;
};

} // namespace cocos2d
