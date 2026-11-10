#pragma once

namespace cocos2d {

class CCActionManager;
class CCAction;

class CCNode {
public:
    explicit CCNode(CCActionManager* actionManager);
    CCAction* runAction(CCAction* action);

private:
    CCActionManager* _actionManager;
};

} // namespace cocos2d
