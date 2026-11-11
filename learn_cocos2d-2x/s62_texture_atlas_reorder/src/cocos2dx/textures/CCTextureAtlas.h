#pragma once

#include <cstddef>
#include <string>
#include <utility>
#include <vector>

class CCTextureAtlas {
public:
    explicit CCTextureAtlas(std::string texture) : m_texture(std::move(texture)) {}

    const std::string& getTexture() const { return m_texture; }
    void appendQuad(const std::string& sprite);
    void reorderQuads(const std::vector<std::string>& order);
    void drawQuads() const;
    void printOrder() const;

private:
    std::string m_texture;
    std::vector<std::string> m_quads;
};
