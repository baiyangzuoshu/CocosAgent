#include "Classes/AppDelegate.h"

#include "cocos/2d/CCScene.h"
#include "cocos/base/CCDirector.h"

#include <iostream>

bool AppDelegate::applicationDidFinishLaunching() {
    std::cout << "AppDelegate::applicationDidFinishLaunching\n";
    auto* director = cocos2d::Director::getInstance();
    director->runWithScene(cocos2d::Scene::create());
    return true;
}
