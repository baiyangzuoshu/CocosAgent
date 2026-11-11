#pragma once

#include <string>

class Mesh;
class MeshCommand;
class Renderer;

class Pass {
public:
    explicit Pass(std::string name);
    void draw(MeshCommand& command, const Mesh& mesh, Renderer& renderer) const;

private:
    std::string m_name;
};
