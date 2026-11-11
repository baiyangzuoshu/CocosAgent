#pragma once

#include <string>

class CCRenderTexture {
public:
    CCRenderTexture(unsigned int framebuffer, std::string texture, int width, int height);
    void beginWithClear();
    void begin();
    void end();
    const std::string& getSpriteTexture() const;

private:
    unsigned int _framebuffer;
    unsigned int _oldFramebuffer = 0;
    int _width;
    int _height;
    std::string _texture;
};
