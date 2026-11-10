#include "AppDelegate.h"
#include "../cocos2d/core/Director.h"
#include <iostream>

bool AppDelegate::applicationDidFinishLaunching() {
    std::cout << "AppDelegate::applicationDidFinishLaunching\n";
    std::cout << "create GLView and HelloWorld scene\n";
    Director::getInstance()->runWithScene("HelloWorld");
    return true;
}
