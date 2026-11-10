#include "AppDelegate.h"
#include "../cocos2d/core/CCDirector.h"
#include <iostream>

bool AppDelegate::applicationDidFinishLaunching() {
    std::cout << "AppDelegate::applicationDidFinishLaunching\n";
    std::cout << "configure OpenGL view and create HelloWorld scene\n";
    CCDirector::sharedDirector()->runWithScene("HelloWorld");
    return true;
}
