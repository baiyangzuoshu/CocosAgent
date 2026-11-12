#pragma once

namespace cocos2d {

class Application {
public:
    Application();
    virtual ~Application();

    static Application* getInstance();
    int run();

protected:
    virtual bool applicationDidFinishLaunching() = 0;

private:
    static Application* _instance;
};

} // namespace cocos2d
