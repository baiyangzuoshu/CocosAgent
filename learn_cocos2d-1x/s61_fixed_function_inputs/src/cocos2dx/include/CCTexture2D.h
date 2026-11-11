#pragma once

#include <array>
#include <string>

class GLClientState {
public:
    void bindTexture(const std::string& name);
    void vertexPointer(const float* values, int components);
    void texCoordPointer(const float* values, int components);
    void drawTriangleStrip(int vertexCount);
};

class CCTexture2D {
public:
    explicit CCTexture2D(GLClientState& gl) : m_gl(gl) {}
    void drawAtPoint(float x, float y);

private:
    GLClientState& m_gl;
    std::string m_texture = "atlas.png";
};
