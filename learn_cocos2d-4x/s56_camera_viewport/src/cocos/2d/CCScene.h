#pragma once

#include <vector>

namespace cocos2d {
class Camera;
class Director;
class Renderer;

class Scene {
public:
    explicit Scene(const Director& director) : _director(director) {}
    void addCamera(Camera* camera) { _cameras.push_back(camera); }
    void render(Renderer* renderer);

private:
    const Director& _director;
    std::vector<Camera*> _cameras;
};
}
