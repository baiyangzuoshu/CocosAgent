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

class ParticleRenderer {
public:
    void addQuadCommand(int indexCount) {
        if (indexCount <= 0) return;
        ++commands;
        submittedIndices += indexCount;
    }
    int commands = 0;
    int submittedIndices = 0;
};

class ParticleSystemQuad : public ParticleSystem {
public:
    static std::unique_ptr<ParticleSystemQuad> create(const std::string& filename);
    bool initWithTotalParticles(int numberOfParticles) override;
    void setTexture(const std::shared_ptr<Texture2D>& texture) override;
    void setTextureWithRect(const std::shared_ptr<Texture2D>& texture, const Rect& rect);
    void updateParticleQuads() override;
    void draw(ParticleRenderer& renderer) const;
    int quadParticleCount() const { return _quadParticleCount; }

    int quadSlots() const { return static_cast<int>(_quads.size()); }
    int indexSlots() const { return static_cast<int>(_indices.size()); }
    const Rect& textureRect() const { return _textureRect; }

private:
    bool allocMemory();
    void initIndices();
    std::vector<Quad> _quads;
    std::vector<std::uint16_t> _indices;
    Rect _textureRect;
    int _quadParticleCount = 0;
};

} // namespace cocos2d
