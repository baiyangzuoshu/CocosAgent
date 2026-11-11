#include "CCMaterial.h"

#include "CCMeshCommand.h"
#include "CCRenderer.h"
#include "cocos/3d/CCMesh.h"

Material::Material(std::vector<std::string> passNames) {
    for (const auto& name : passNames) m_passes.emplace_back(name);
}

std::size_t Material::passCount() const {
    return m_passes.size();
}

void Material::draw(std::vector<MeshCommand>& commands, const Mesh& mesh, Renderer& renderer) const {
    for (std::size_t i = 0; i < m_passes.size(); ++i) {
        m_passes[i].draw(commands[i], mesh, renderer);
    }
}
