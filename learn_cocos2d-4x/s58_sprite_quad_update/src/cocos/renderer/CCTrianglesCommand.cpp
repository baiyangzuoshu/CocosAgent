#include "CCTrianglesCommand.h"

namespace cocos2d {

void TrianglesCommand::init(float globalOrder, backend::TextureBackend* texture,
                            BlendFunc blend, const Triangles& triangles,
                            const std::string& transform) {
    m_globalOrder = globalOrder;
    m_texture = texture;
    m_blendDescriptor.enabled = true;
    m_blendDescriptor.source = blend.src;
    m_blendDescriptor.destination = blend.dst;
    m_triangles = triangles;
    m_transform = transform;
}

void TrianglesCommand::execute() const {
    std::cout << "backend TrianglesCommand: verts=" << m_triangles.verts.size()
              << " indices=" << m_triangles.indices.size()
              << " texture=" << (m_texture ? m_texture->id : 0)
              << " blend=" << m_blendDescriptor.source << "/"
              << m_blendDescriptor.destination
              << " transform=" << m_transform << "\n";
    std::cout << "BL=(" << m_triangles.verts[0].x << "," << m_triangles.verts[0].y
              << ") rgba=(" << static_cast<int>(m_triangles.verts[0].r) << ","
              << static_cast<int>(m_triangles.verts[0].g) << ","
              << static_cast<int>(m_triangles.verts[0].b) << ","
              << static_cast<int>(m_triangles.verts[0].a) << ")\n";
}

} // namespace cocos2d
