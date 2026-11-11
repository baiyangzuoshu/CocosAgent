#include "CCSprite3D.h"

#include "cocos/renderer/CCRenderer.h"

#include <iostream>
#include <utility>

Sprite3D::Sprite3D(std::string transform) : m_transform(std::move(transform)) {}

void Sprite3D::addMesh(Mesh mesh) {
    m_meshes.push_back(std::move(mesh));
}

void Sprite3D::draw(Renderer& renderer) {
    std::cout << "Sprite3D::draw: " << m_meshes.size() << " mesh(es)\n";
    for (auto& mesh : m_meshes) mesh.draw(renderer, m_transform, 0.0f);
}
