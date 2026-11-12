#include "Classes/AppDelegate.h"
#include "cocos/platform/CCApplication.h"

int main(int argc, char* argv[]) {
    (void)argc;
    (void)argv;

    AppDelegate app;
    return cocos2d::Application::getInstance()->run();
}
