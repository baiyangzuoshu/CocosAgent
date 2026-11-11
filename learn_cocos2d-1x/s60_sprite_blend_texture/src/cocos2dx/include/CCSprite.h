#pragma once

#include <string>

struct BlendFunc {
    std::string src;
    std::string dst;
};

class GLState {
public:
    void blendFunc(const BlendFunc& blend);
    void bindTexture2D(const std::string& texture);
    void setVertexPointers();
    void drawArrays(const char* primitive, int first, int count);
};

class CCSprite {
public:
    explicit CCSprite(GLState& gl);
    void setTexture(const std::string& texture) { m_texture = texture; }
    void setBlendFunc(const BlendFunc& blend) { m_blend = blend; }
    void draw();

private:
    GLState& m_gl;
    std::string m_texture;
    BlendFunc m_blend;
};
