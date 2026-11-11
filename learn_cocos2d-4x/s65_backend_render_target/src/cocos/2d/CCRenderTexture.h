#pragma once

#include "../renderer/CCRenderer.h"

class RenderTexture {
public:
    explicit RenderTexture(Renderer& renderer);
    void begin();
    void addSceneDraw();
    void end();
    void getSprite() const;

private:
    Renderer& _renderer;
};
