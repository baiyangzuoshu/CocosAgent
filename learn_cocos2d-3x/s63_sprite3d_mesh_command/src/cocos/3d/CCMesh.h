#pragma once

#include "cocos/renderer/CCMeshCommand.h"

#include <cstddef>
#include <string>

class Renderer;

class Mesh {
public:
    Mesh(std::string name, std::string material, std::size_t indexCount);
    void draw(Renderer& renderer, const std::string& transform);

private:
    std::string m_name;
    std::string m_material;
    std::size_t m_indexCount;
    MeshCommand m_meshCommand;
};
