#pragma once

#include <iostream>
#include <string>

class CCDirector {
public:
    static CCDirector* sharedDirector() {
        static CCDirector director;
        return &director;
    }

    void runWithScene(const std::string& sceneName) {
        std::cout << "CCDirector::runWithScene(" << sceneName << ")\n";
    }
};
