#pragma once

#include "CCMesh.h"

#include <string>
#include <vector>

class Renderer;

class Sprite3D {
public:
    explicit Sprite3D(std::string transform);
    void addMesh(Mesh mesh);
    void draw(Renderer& renderer);

private:
    std::string m_transform;
    std::vector<Mesh> m_meshes;
};
