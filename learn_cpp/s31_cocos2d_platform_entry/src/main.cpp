#include <iostream>
#include <memory>
#include <string>

class Application
{
public:
    Application() { instance_ = this; }
    virtual ~Application()
    {
        if (instance_ == this)
            instance_ = nullptr;
    }

    static Application* getInstance() { return instance_; }

    int run()
    {
        std::cout << "Application::run\n";
        return applicationDidFinishLaunching() ? 0 : 1;
    }

protected:
    virtual bool applicationDidFinishLaunching() = 0;

private:
    static Application* instance_;
};

Application* Application::instance_ = nullptr;

class AppDelegate final : private Application
{
protected:
    bool applicationDidFinishLaunching() override
    {
        std::cout << "AppDelegate::applicationDidFinishLaunching\n";
        return true;
    }
};

int desktopEntry()
{
    std::cout << "desktop main creates AppDelegate\n";
    AppDelegate app;
    return Application::getInstance()->run();
}

int androidJniEntry()
{
    std::cout << "Android JNI hook creates AppDelegate\n";
    static std::unique_ptr<AppDelegate> app = std::make_unique<AppDelegate>();
    return Application::getInstance()->run();
}

int main(int argc, char** argv)
{
    const bool androidPath = argc > 1 && std::string(argv[1]) == "android";
    return androidPath ? androidJniEntry() : desktopEntry();
}
