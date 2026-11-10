#pragma once

#include "CCParticleSystem.h"

#include <array>
#include <cstdint>
#include <memory>
#include <vector>

namespace cocos2d {

struct Rect {
    float x = 0;
    float y = 0;
    float width = 16;
    float height = 16;
};

struct Quad {
    std::array<float, 8> vertices{};
};

class ParticleSystemQuad : public ParticleSystem {
public:
    static std::unique_ptr<ParticleSystemQuad> create(const std::string& filename);
    bool initWithTotalParticles(int numberOfParticles) override;
    void setTexture(const std::shared_ptr<Texture2D>& texture) override;
    void setTextureWithRect(const std::shared_ptr<Texture2D>& texture, const Rect& rect);

    int quadSlots() const { return static_cast<int>(_quads.size()); }
    int indexSlots() const { return static_cast<int>(_indices.size()); }
    const Rect& textureRect() const { return _textureRect; }

private:
    bool allocMemory();
    void initIndices();
    std::vector<Quad> _quads;
    std::vector<std::uint16_t> _indices;
    Rect _textureRect;
};

} // namespace cocos2d
