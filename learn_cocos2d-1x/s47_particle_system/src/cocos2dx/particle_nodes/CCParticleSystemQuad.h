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
    static std::unique_ptr<CCParticleSystemQuad> particleWithFile(const char* plistFile);
    bool initWithTotalParticles(unsigned numberOfParticles) override;
    void setTexture(const std::shared_ptr<CCTexture2D>& texture) override;
    void setTextureWithRect(const std::shared_ptr<CCTexture2D>& texture, const CCRect& rect);

    unsigned quadSlots() const { return static_cast<unsigned>(m_pQuads.size()); }
    unsigned indexSlots() const { return static_cast<unsigned>(m_pIndices.size()); }
    const CCRect& textureRect() const { return m_textureRect; }

private:
    void initIndices();
    std::vector<ccV2F_C4B_T2F_Quad> m_pQuads;
    std::vector<std::uint16_t> m_pIndices;
    CCRect m_textureRect;
};

} // namespace cocos2d
