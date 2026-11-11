#pragma once

#include <iostream>

namespace cocos2d {
class Renderer {
public:
    void addTrianglesCommand(const char* cameraName) {
        std::cout << "Renderer.queue(TrianglesCommand, camera=" << cameraName << ")\n";
    }
    void render() {
        std::cout << "Renderer.render() -> execute GL render queue\n";
    }
};
}
