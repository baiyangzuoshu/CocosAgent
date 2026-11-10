#pragma once

#include "../Classes/AppDelegate.h"
#include <iostream>

class Application {
public:
    static Application* getInstance() {
        static Application application;
        return &application;
    }

    int run() {
        std::cout << "Application::run -> AppDelegate callback\n";
        AppDelegate app;
        return app.applicationDidFinishLaunching() ? 0 : 1;
    }
};
