#pragma once

#include "cocos/renderer/CCTextureCache.h"
#include "cocos/renderer/CCRenderer.h"

namespace cocos2d {

class Scene;

class Director {
public:
    static Director* getInstance();
    TextureCache* getTextureCache() { return &_textureCache; }
    void runWithScene(Scene* scene) { _runningScene = scene; }
    void drawScene();

private:
    TextureCache _textureCache;
    Renderer _renderer;
    Scene* _runningScene = nullptr;
};

} // namespace cocos2d
