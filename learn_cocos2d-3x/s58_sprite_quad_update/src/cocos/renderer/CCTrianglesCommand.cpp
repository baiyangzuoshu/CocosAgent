#include "CCTrianglesCommand.h"

namespace cocos2d {

void TrianglesCommand::init(float globalOrder, int textureId, GLProgramState* programState,
                            BlendFunc blend, const Triangles& triangles,
                            const std::string& transform) {
    m_globalOrder = globalOrder;
    m_textureId = textureId;
    m_programState = programState;
    m_blend = blend;
    m_triangles = triangles;
    m_transform = transform;
}

void TrianglesCommand::execute() const {
    std::cout << "TrianglesCommand: verts=" << m_triangles.verts.size()
              << " indices=" << m_triangles.indices.size()
              << " textureId=" << m_textureId
              << " GLProgramState=" << (m_programState ? m_programState->id : 0)
              << " blend=" << m_blend.src << "/" << m_blend.dst
              << " transform=" << m_transform << "\n";
    std::cout << "BL=(" << m_triangles.verts[0].x << "," << m_triangles.verts[0].y
              << ") rgba=(" << static_cast<int>(m_triangles.verts[0].r) << ","
              << static_cast<int>(m_triangles.verts[0].g) << ","
              << static_cast<int>(m_triangles.verts[0].b) << ","
              << static_cast<int>(m_triangles.verts[0].a) << ")\n";
}

} // namespace cocos2d
