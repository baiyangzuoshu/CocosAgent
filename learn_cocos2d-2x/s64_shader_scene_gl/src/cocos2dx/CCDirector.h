#pragma once

class CCNode;

class CCDirector {
public:
    explicit CCDirector(CCNode* runningScene);
    void drawScene();

private:
    CCNode* _runningScene;
};
