#pragma once

#include <cstddef>
#include <string>

class TrianglesCommand {
public:
    TrianglesCommand(std::string name, std::string materialId, std::size_t indexCount, bool skipBatching);

    const std::string& getName() const { return m_name; }
    const std::string& getMaterialID() const { return m_materialId; }
    std::size_t getIndexCount() const { return m_indexCount; }
    std::size_t getVertexCount() const { return m_vertexCount; }
    bool isSkipBatching() const { return m_skipBatching; }

private:
    std::string m_name;
    std::string m_materialId;
    std::size_t m_indexCount;
    std::size_t m_vertexCount;
    bool m_skipBatching;
};
