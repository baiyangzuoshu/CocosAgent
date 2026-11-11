#include "CCMesh.h"

#include "cocos/renderer/CCMaterial.h"
#include "cocos/renderer/CCRenderer.h"

#include <iostream>
#include <utility>

Mesh::Mesh(std::string name, const Material& material, std::size_t indexCount)
    : m_name(std::move(name)), m_material(material), m_indexCount(indexCount),
      m_meshCommands(material.passCount()) {}

void Mesh::draw(Renderer& renderer, const std::string& transform, float globalZOrder) {
    std::cout << "Mesh::draw " << m_name << ": " << m_meshCommands.size() << " pass command(s)\n";
    for (auto& command : m_meshCommands) command.init(globalZOrder, transform);
    m_material.draw(m_meshCommands, *this, renderer);
}

std::string Mesh::vertexBuffer() const {
    return m_name + "-backend-VB";
}

std::string Mesh::indexBuffer() const {
    return m_name + "-backend-IB";
}

std::size_t Mesh::indexCount() const {
    return m_indexCount;
}
