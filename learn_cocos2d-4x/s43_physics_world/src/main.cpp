#include "cocos/2d/CCScene.h"
#include "cocos/base/CCDirector.h"

int main() {
    cocos2d::Scene* scene = cocos2d::Scene::createWithPhysics();
    scene->getPhysicsWorld()->setFixedUpdateRate(60);

    cocos2d::Director director(scene);
    director.mainLoop(0.04f);
    delete scene;
    return 0;
}
