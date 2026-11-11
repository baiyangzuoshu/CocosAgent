#pragma once

#include <cstddef>
#include <string>
#include <utility>

class TextureAtlas {
public:
    TextureAtlas(std::string texture, std::size_t quadCount)
        : m_texture(std::move(texture)), m_quadCount(quadCount) {}

    const std::string& getTexture() const { return m_texture; }
    std::size_t getTotalQuads() const { return m_quadCount; }
    void drawQuads() const;

private:
    std::string m_texture;
    std::size_t m_quadCount;
};
