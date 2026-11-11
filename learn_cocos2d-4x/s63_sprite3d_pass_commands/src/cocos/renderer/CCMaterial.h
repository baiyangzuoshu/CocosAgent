#pragma once

#include "CCPass.h"

#include <cstddef>
#include <string>
#include <vector>

class Mesh;
class MeshCommand;
class Renderer;

class Material {
public:
    explicit Material(std::vector<std::string> passNames);
    std::size_t passCount() const;
    void draw(std::vector<MeshCommand>& commands, const Mesh& mesh, Renderer& renderer) const;

private:
    std::vector<Pass> m_passes;
};
