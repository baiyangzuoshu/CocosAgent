#include "CCMesh.h"

#include "cocos/renderer/CCRenderer.h"

#include <iostream>
#include <utility>

Mesh::Mesh(std::string name, std::string material, std::size_t indexCount)
    : m_name(std::move(name)), m_material(std::move(material)), m_indexCount(indexCount) {}

void Mesh::draw(Renderer& renderer, const std::string& transform) {
    std::cout << "Mesh::draw " << m_name << "\n";
    m_meshCommand.init(
        m_material, m_name + "-VB", m_name + "-IB", "TRIANGLES", m_indexCount, transform);
    renderer.addCommand(&m_meshCommand);
}
