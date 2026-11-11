#include "CCMeshCommand.h"

#include <iostream>

void MeshCommand::init(float globalZOrder, const std::string& transform) {
    m_globalZOrder = globalZOrder;
    m_transform = transform;
}

void MeshCommand::setDrawData(
    const std::string& pass,
    const std::string& programState,
    const std::string& vertexBuffer,
    const std::string& indexBuffer,
    const std::string& primitive,
    const std::string& indexFormat,
    std::size_t indexCount) {
    m_pass = pass;
    m_programState = programState;
    m_vertexBuffer = vertexBuffer;
    m_indexBuffer = indexBuffer;
    m_primitive = primitive;
    m_indexFormat = indexFormat;
    m_indexCount = indexCount;
    m_hasBeforeCallback = true;
    m_hasAfterCallback = true;
}

void MeshCommand::describe() const {
    std::cout << "MeshCommand pass=" << m_pass << ", program=" << m_programState
              << ", VB=" << m_vertexBuffer << ", IB=" << m_indexBuffer
              << ", primitive=" << m_primitive << ", indexFormat=" << m_indexFormat
              << ", indices=" << m_indexCount
              << ", z=" << m_globalZOrder << ", transform=" << m_transform << "\n";
    std::cout << "  before/after callbacks=" << (m_hasBeforeCallback && m_hasAfterCallback) << "\n";
}
