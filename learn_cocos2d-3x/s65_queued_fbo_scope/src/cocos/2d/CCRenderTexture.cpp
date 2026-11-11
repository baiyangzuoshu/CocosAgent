#include "CCRenderTexture.h"

#include <iostream>

namespace {
void glGetFramebufferBinding(unsigned int& value) { value = 2; }
void glBindFramebuffer(unsigned int value) { std::cout << "glBindFramebuffer(" << value << ")\n"; }
}

RenderTexture::RenderTexture(Renderer& renderer) : _renderer(renderer) {}

void RenderTexture::begin() {
    _renderer.beginGroup();
    _renderer.addCallback("RenderTexture.onBegin", [this]() { onBegin(); });
}

void RenderTexture::addSceneDraw(const char* name) {
    _renderer.addDraw(name);
}

void RenderTexture::end() {
    _renderer.addCallback("RenderTexture.onEnd", [this]() { onEnd(); });
    _renderer.endGroup();
}

void RenderTexture::onBegin() {
    glGetFramebufferBinding(_oldFBO);
    glBindFramebuffer(17);
    std::cout << "RenderTexture.onBegin adjusts GL viewport\n";
}

void RenderTexture::onEnd() {
    glBindFramebuffer(_oldFBO);
    std::cout << "RenderTexture.onEnd restores viewport\n";
}
