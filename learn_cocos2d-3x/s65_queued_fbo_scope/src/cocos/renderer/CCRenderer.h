#pragma once

#include <functional>
#include <memory>
#include <string>
#include <vector>

class Renderer {
public:
    using Work = std::function<void()>;
    Renderer();
    void beginGroup();
    void addCallback(const std::string& name, Work work);
    void addDraw(const std::string& name);
    void endGroup();
    void render();

private:
    std::vector<Work> _mainQueue;
    std::shared_ptr<std::vector<Work>> _groupQueue;
    std::vector<Work>* _currentQueue;
};
