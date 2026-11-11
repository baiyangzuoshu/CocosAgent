#include "CCScene.h"

#include "CCCamera.h"
#include "../base/CCDirector.h"
#include "../renderer/CCRenderer.h"

#include <algorithm>
#include <iostream>

namespace cocos2d {
void Scene::render(Renderer* renderer) {
    std::stable_sort(_cameras.begin(), _cameras.end(), [](Camera* a, Camera* b) {
        return a->getRenderOrder() < b->getRenderOrder();
    });

    for (Camera* camera : _cameras) {
        _director.loadCameraProjection(camera->getName());
        camera->apply();
        camera->clearBackground();
        std::cout << "Scene::visit -> append draw command\n";
        renderer->addTrianglesCommand(camera->getName());
        renderer->render();
        camera->restore();
    }
}
}
