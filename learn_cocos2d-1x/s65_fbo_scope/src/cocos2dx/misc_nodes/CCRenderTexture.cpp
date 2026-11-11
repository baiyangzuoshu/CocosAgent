#include "CCRenderTexture.h"

#include <iostream>
#include <utility>

namespace {
void glGetFramebufferBinding(unsigned int& value) {
    value = 3;
    std::cout << "save current framebuffer\n";
}
void glBindFramebuffer(unsigned int value) { std::cout << "glBindFramebuffer(" << value << ")\n"; }
void glViewport(int width, int height) { std::cout << "glViewport(" << width << ", " << height << ")\n"; }
void glClear() { std::cout << "glClear(color | depth)\n"; }
}

CCRenderTexture::CCRenderTexture(unsigned int framebuffer, std::string texture, int width, int height)
    : _framebuffer(framebuffer), _width(width), _height(height), _texture(std::move(texture)) {
    std::cout << "CCRenderTexture creates FBO and attaches texture " << _texture << "\n";
}

void CCRenderTexture::beginWithClear() {
    begin();
    glClear();
}

void CCRenderTexture::begin() {
    std::cout << "CCRenderTexture.begin -> save matrix and adjust projection\n";
    glGetFramebufferBinding(_oldFramebuffer);
    glBindFramebuffer(_framebuffer);
    glViewport(_width, _height);
}

void CCRenderTexture::end() {
    glBindFramebuffer(_oldFramebuffer);
    std::cout << "restore display viewport and pop matrix\n";
}

const std::string& CCRenderTexture::getSpriteTexture() const {
    return _texture;
}
