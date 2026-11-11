#pragma once

#include <cstddef>
#include <string>

class MeshCommand {
public:
    void init(
        const std::string& material,
        const std::string& vertexBuffer,
        const std::string& indexBuffer,
        const std::string& primitive,
        std::size_t indexCount,
        const std::string& transform);
    void describe() const;

private:
    std::string m_material;
    std::string m_vertexBuffer;
    std::string m_indexBuffer;
    std::string m_primitive;
    std::string m_transform;
    std::size_t m_indexCount = 0;
};
