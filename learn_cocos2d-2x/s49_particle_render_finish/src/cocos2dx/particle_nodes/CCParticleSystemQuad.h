#pragma once

#include "CCParticleSystem.h"

#include <array>
#include <cstdint>
#include <memory>
#include <vector>

namespace cocos2d {

struct CCRect {
    float x = 0;
    float y = 0;
    float width = 16;
    float height = 16;
};

struct ccV2F_C4B_T2F_Quad {
    std::array<float, 8> vertices{};
};

class CCParticleSystemQuad : public CCParticleSystem {
public:
    static std::unique_ptr<CCParticleSystemQuad> create(const char* plistFile);
    bool initWithTotalParticles(unsigned numberOfParticles) override;
    void setTexture(const std::shared_ptr<CCTexture2D>& texture) override;
    void setTextureWithRect(const std::shared_ptr<CCTexture2D>& texture, const CCRect& rect);
    void updateQuadWithParticle(unsigned particleIndex) override;
    void postStep() override;
    unsigned uploadedQuadCount() const { return m_uploadedQuadCount; }
    unsigned draw() const { return m_uploadedQuadCount * 6; }

    unsigned quadSlots() const { return static_cast<unsigned>(m_pQuads.size()); }
    unsigned indexSlots() const { return static_cast<unsigned>(m_pIndices.size()); }
    unsigned vboParticleSlots() const { return m_vboParticleSlots; }

private:
    bool allocMemory();
    void initIndices();
    void setupVBO();
    std::vector<ccV2F_C4B_T2F_Quad> m_pQuads;
    std::vector<std::uint16_t> m_pIndices;
    unsigned m_vboParticleSlots = 0;
    unsigned m_uploadedQuadCount = 0;
};

} // namespace cocos2d
