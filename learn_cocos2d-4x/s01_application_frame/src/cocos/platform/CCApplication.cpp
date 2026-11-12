#include "cocos/platform/CCApplication.h"

#include "cocos/base/CCDirector.h"

#include <iostream>
#include <stdexcept>

namespace cocos2d {

Application* Application::_instance = nullptr;

Application::Application() {
    if (_instance) {
        throw std::logic_error("only one Application may exist");
    }
    _instance = this;
}

Application::~Application() {
    if (_instance == this) {
        _instance = nullptr;
    }
}

Application* Application::getInstance() {
    return _instance;
}

int Application::run() {
    std::cout << "Application::run\n";
    if (!applicationDidFinishLaunching()) {
        return 1;
    }

    auto* director = Director::getInstance();
    for (int frame = 1; frame <= 3; ++frame) {
        std::cout << "platform frame " << frame << '\n';
        director->mainLoop();
    }
    return 0;
}

} // namespace cocos2d
