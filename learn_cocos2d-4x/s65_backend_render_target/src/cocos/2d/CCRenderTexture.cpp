#include "CCRenderTexture.h"

#include <iostream>

RenderTexture::RenderTexture(Renderer& renderer) : _renderer(renderer) {}

void RenderTexture::begin() {
    std::cout << "RenderTexture.begin\n";
    _renderer.beginGroup();
    _renderer.addCallback("RenderTexture.onBegin", [this]() {
        _renderer.setRenderTarget("camera-color", "camera-depth-stencil");
    });
}

void RenderTexture::addSceneDraw() {
    _renderer.addSceneDraw();
}

void RenderTexture::end() {
    std::cout << "RenderTexture.end\n";
    _renderer.addCallback("RenderTexture.onEnd", [this]() {
        _renderer.restoreRenderTarget();
    });
    _renderer.endGroup();
}

void RenderTexture::getSprite() const {
    std::cout << "Sprite samples camera-color texture\n";
}
