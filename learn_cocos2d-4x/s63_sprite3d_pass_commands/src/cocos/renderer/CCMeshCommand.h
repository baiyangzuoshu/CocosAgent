#pragma once

#include <cstddef>
#include <string>

class MeshCommand {
public:
    void init(float globalZOrder, const std::string& transform);
    void setDrawData(
        const std::string& pass,
        const std::string& programState,
        const std::string& vertexBuffer,
        const std::string& indexBuffer,
        const std::string& primitive,
        const std::string& indexFormat,
        std::size_t indexCount);
    void describe() const;

private:
    float m_globalZOrder = 0.0f;
    std::string m_transform;
    std::string m_pass;
    std::string m_programState;
    std::string m_vertexBuffer;
    std::string m_indexBuffer;
    std::string m_primitive;
    std::string m_indexFormat;
    std::size_t m_indexCount = 0;
    bool m_hasBeforeCallback = false;
    bool m_hasAfterCallback = false;
};
