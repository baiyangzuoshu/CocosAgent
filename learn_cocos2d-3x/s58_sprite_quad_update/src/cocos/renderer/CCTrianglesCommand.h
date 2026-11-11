#pragma once

#include "../2d/CCSprite.h"
#include <iostream>

namespace cocos2d {

class TrianglesCommand {
public:
    void init(float globalOrder, int textureId, GLProgramState* programState,
              BlendFunc blend, const Triangles& triangles, const std::string& transform);
    void execute() const;

private:
    float m_globalOrder = 0;
    int m_textureId = 0;
    GLProgramState* m_programState = nullptr;
    BlendFunc m_blend;
    Triangles m_triangles;
    std::string m_transform;
};

} // namespace cocos2d
