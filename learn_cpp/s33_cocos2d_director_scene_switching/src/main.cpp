#include <iostream>
#include <memory>
#include <string>
#include <utility>
#include <vector>

struct Scene
{
    explicit Scene(std::string value) : name(std::move(value)) {}
    std::string name;

    void onEnter() const { std::cout << name << ".onEnter\n"; }
    void onExit() const { std::cout << name << ".onExit\n"; }
    void cleanup() const { std::cout << name << ".cleanup\n"; }
};

class Director
{
public:
    void runWithScene(std::shared_ptr<Scene> scene)
    {
        stack_.push_back(scene);
        next_ = std::move(scene);
    }

    void pushScene(std::shared_ptr<Scene> scene)
    {
        stack_.push_back(scene);
        next_ = std::move(scene);
        cleanupOld_ = false;
    }

    void replaceScene(std::shared_ptr<Scene> scene)
    {
        if (stack_.empty())
            return runWithScene(std::move(scene));
        stack_.back() = scene;
        next_ = std::move(scene);
        cleanupOld_ = true;
    }

    void popScene()
    {
        if (stack_.size() <= 1)
        {
            std::cout << "Director::end requested\n";
            return;
        }
        stack_.pop_back();
        next_ = stack_.back();
        cleanupOld_ = true;
    }

    void drawScene()
    {
        if (next_)
        {
            std::cout << "apply pending scene\n";
            if (running_)
            {
                running_->onExit();
                if (cleanupOld_)
                    running_->cleanup();
            }
            running_ = std::move(next_);
            running_->onEnter();
            cleanupOld_ = false;
        }
        std::cout << "draw: " << (running_ ? running_->name : "none") << '\n';
    }

    const std::string runningName() const
    {
        return running_ ? running_->name : "none";
    }

private:
    std::vector<std::shared_ptr<Scene>> stack_;
    std::shared_ptr<Scene> running_;
    std::shared_ptr<Scene> next_;
    bool cleanupOld_{false};
};

int main()
{
    Director director;
    director.runWithScene(std::make_shared<Scene>("A"));
    director.drawScene();

    director.pushScene(std::make_shared<Scene>("B"));
    std::cout << "before next draw, running=" << director.runningName() << '\n';
    director.drawScene();

    director.popScene();
    director.drawScene();
}
