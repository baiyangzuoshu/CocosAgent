#pragma once

#include <string>

struct BlendFunc {
    std::string src;
    std::string dst;
};

class CCGLProgram {
public:
    void use() const;
    void setUniformsForBuiltins() const;
};

class GLState {
public:
    void blendFunc(const BlendFunc& blend);
    void bindTexture2D(const std::string& texture);
    void enablePositionColorTex();
    void setVertexAttribPointers();
    void drawArrays(const char* primitive, int first, int count);
};

class CCSprite {
public:
    explicit CCSprite(GLState& gl);
    CCGLProgram& getShaderProgram() { return m_program; }
    void setTexture(const std::string& texture) { m_texture = texture; }
    void setBlendFunc(const BlendFunc& blend) { m_blend = blend; }
    void draw();

private:
    GLState& m_gl;
    CCGLProgram m_program;
    std::string m_texture;
    BlendFunc m_blend;
};

#define CC_NODE_DRAW_SETUP() \
    do { \
        getShaderProgram().use(); \
        getShaderProgram().setUniformsForBuiltins(); \
    } while (false)
