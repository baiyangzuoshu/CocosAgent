#pragma once

#include <iostream>
#include <string>

class Director {
public:
    static Director* getInstance() {
        static Director director;
        return &director;
    }

    void runWithScene(const std::string& sceneName) {
        std::cout << "Director::runWithScene(" << sceneName << ")\n";
    }
};
