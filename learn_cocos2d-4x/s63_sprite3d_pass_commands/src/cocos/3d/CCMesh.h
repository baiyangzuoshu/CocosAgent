#pragma once

#include "cocos/renderer/CCMeshCommand.h"

#include <cstddef>
#include <string>
#include <vector>

class Material;
class Renderer;

class Mesh {
public:
    Mesh(std::string name, const Material& material, std::size_t indexCount);
    void draw(Renderer& renderer, const std::string& transform, float globalZOrder);
    std::string vertexBuffer() const;
    std::string indexBuffer() const;
    std::size_t indexCount() const;

private:
    std::string m_name;
    const Material& m_material;
    std::size_t m_indexCount;
    std::vector<MeshCommand> m_meshCommands;
};
