#include "CCMeshCommand.h"

#include <iostream>

void MeshCommand::init(
    const std::string& material,
    const std::string& vertexBuffer,
    const std::string& indexBuffer,
    const std::string& primitive,
    std::size_t indexCount,
    const std::string& transform) {
    m_material = material;
    m_vertexBuffer = vertexBuffer;
    m_indexBuffer = indexBuffer;
    m_primitive = primitive;
    m_indexCount = indexCount;
    m_transform = transform;
}

void MeshCommand::describe() const {
    std::cout << "MeshCommand material=" << m_material << ", VB=" << m_vertexBuffer
              << ", IB=" << m_indexBuffer << ", primitive=" << m_primitive
              << ", indices=" << m_indexCount
              << ", transform=" << m_transform << "\n";
}
