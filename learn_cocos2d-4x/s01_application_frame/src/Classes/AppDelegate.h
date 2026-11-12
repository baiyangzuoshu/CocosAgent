#pragma once

#include "cocos/platform/CCApplication.h"

class AppDelegate final : private cocos2d::Application {
public:
    bool applicationDidFinishLaunching() override;
};
