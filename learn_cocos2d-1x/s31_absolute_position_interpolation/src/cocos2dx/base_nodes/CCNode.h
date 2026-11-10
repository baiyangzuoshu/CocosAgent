#pragma once

namespace cocos2d {

class CCActionManager;
class CCAction;

class CCNode {
public:
    explicit CCNode(CCActionManager* actionManager);
    CCAction* runAction(CCAction* action);
    float getPositionX() const;
    void setPositionX(float x);

private:
    CCActionManager* _actionManager;
    float _positionX = 0.0f;
};

} // namespace cocos2d
