#pragma once

namespace cocos2d {
class CCScene;

class CCDirector {
public:
    static CCDirector& sharedDirector();
    void runWithScene(CCScene* scene) { _runningScene = scene; }
    void drawScene();

private:
    CCScene* _runningScene = nullptr;
};
} // namespace cocos2d
