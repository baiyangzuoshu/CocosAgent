#pragma once

#include "../renderer/CCRenderer.h"

class RenderTexture {
public:
    explicit RenderTexture(Renderer& renderer);
    void begin();
    void addSceneDraw(const char* name);
    void end();

private:
    void onBegin();
    void onEnd();
    Renderer& _renderer;
    unsigned int _oldFBO = 0;
};
