#include "CCRenderer.h"

#include <iostream>

Renderer::Renderer() : _currentQueue(&_mainQueue) {}

void Renderer::beginGroup() {
    _groupQueue = std::make_shared<std::vector<Work>>();
    const auto group = _groupQueue;
    _mainQueue.push_back([group]() {
        std::cout << "Renderer.processGroupCommand\n";
        for (const Work& work : *group) work();
    });
    _currentQueue = _groupQueue.get();
    std::cout << "Renderer.add GroupCommand and pushGroup\n";
}

void Renderer::addCallback(const std::string& name, Work work) {
    _currentQueue->push_back([name, work]() {
        std::cout << "Renderer.execute CallbackCommand " << name << "\n";
        work();
    });
}

void Renderer::addDraw(const std::string& name) {
    _currentQueue->push_back([name]() {
        std::cout << "execute scene draw command " << name << "\n";
    });
}

void Renderer::endGroup() {
    _currentQueue = &_mainQueue;
    std::cout << "Renderer.popGroup\n";
}

void Renderer::render() {
    std::cout << "Renderer.render sorts and visits the main queue\n";
    for (const Work& work : _mainQueue) work();
    _mainQueue.clear();
    _groupQueue.reset();
}
