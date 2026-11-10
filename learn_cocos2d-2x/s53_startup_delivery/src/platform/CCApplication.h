#pragma once

#include "../Classes/AppDelegate.h"
#include <iostream>

class CCApplication {
public:
    static CCApplication* sharedApplication() {
        static CCApplication application;
        return &application;
    }

    int run() {
        std::cout << "CCApplication::run -> AppDelegate callback\n";
        AppDelegate app;
        return app.applicationDidFinishLaunching() ? 0 : 1;
    }
};
