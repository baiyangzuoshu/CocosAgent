#pragma once

#include "../2d/CCSprite.h"
#include <iostream>

namespace cocos2d {

class TrianglesCommand {
public:
    void init(float globalOrder, backend::TextureBackend* texture, BlendFunc blend,
              const Triangles& triangles, const std::string& transform);
    void execute() const;

private:
    float m_globalOrder = 0;
    backend::TextureBackend* m_texture = nullptr;
    backend::BlendDescriptor m_blendDescriptor;
    Triangles m_triangles;
    std::string m_transform;
};

} // namespace cocos2d
