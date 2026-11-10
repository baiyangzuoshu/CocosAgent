#pragma once

namespace cocos2d {

class Scene;

class Director {
public:
    explicit Director(Scene* scene) : _runningScene(scene) {}
    void mainLoop(float deltaTime);

private:
    Scene* _runningScene;
};

}
