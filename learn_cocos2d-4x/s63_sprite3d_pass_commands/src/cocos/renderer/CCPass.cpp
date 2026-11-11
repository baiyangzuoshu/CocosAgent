#include "CCPass.h"

#include "CCMaterial.h"
#include "CCMeshCommand.h"
#include "CCRenderer.h"
#include "cocos/3d/CCMesh.h"

#include <utility>

Pass::Pass(std::string name) : m_name(std::move(name)) {}

void Pass::draw(MeshCommand& command, const Mesh& mesh, Renderer& renderer) const {
    command.setDrawData(
        m_name,
        "program-" + m_name,
        mesh.vertexBuffer(),
        mesh.indexBuffer(),
        "TRIANGLES",
        "USHORT",
        mesh.indexCount());
    renderer.addCommand(&command);
}
