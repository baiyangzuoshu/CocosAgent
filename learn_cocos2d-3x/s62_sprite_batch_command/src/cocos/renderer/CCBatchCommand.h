#pragma once

#include "CCTextureAtlas.h"

#include <string>

class BatchCommand {
public:
    void init(const std::string& shader, const std::string& blend, TextureAtlas& atlas);
    void execute() const;

private:
    std::string m_shader;
    std::string m_blend;
    std::string m_texture;
    TextureAtlas* m_textureAtlas = nullptr;
};
