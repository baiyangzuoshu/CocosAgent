#include "CCRenderCommand.h"

#include <utility>

TrianglesCommand::TrianglesCommand(
    std::string name,
    std::string materialId,
    std::size_t indexCount,
    bool skipBatching)
    : m_name(std::move(name)),
      m_materialId(std::move(materialId)),
      m_indexCount(indexCount),
      m_vertexCount(indexCount / 3 * 2),
      m_skipBatching(skipBatching) {}
