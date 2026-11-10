#include "CCParticleSystemQuad.h"

namespace cocos2d {

std::unique_ptr<CCParticleSystemQuad> CCParticleSystemQuad::particleWithFile(const char* plistFile) {
    std::unique_ptr<CCParticleSystemQuad> system(new CCParticleSystemQuad());
    if (!system->initWithFile(plistFile)) return nullptr;
    return system;
}

bool CCParticleSystemQuad::initWithTotalParticles(unsigned numberOfParticles) {
    if (!CCParticleSystem::initWithTotalParticles(numberOfParticles)) return false;
    m_pQuads.assign(numberOfParticles, ccV2F_C4B_T2F_Quad{});
    m_pIndices.resize(numberOfParticles * 6);
    initIndices();
    return true;
}

void CCParticleSystemQuad::setTexture(const std::shared_ptr<CCTexture2D>& texture) {
    setTextureWithRect(texture, CCRect{});
}

void CCParticleSystemQuad::setTextureWithRect(const std::shared_ptr<CCTexture2D>& texture, const CCRect& rect) {
    CCParticleSystem::setTexture(texture);
    m_textureRect = rect;
}

void CCParticleSystemQuad::initIndices() {
    for (unsigned i = 0; i < m_uTotalParticles; ++i) {
        const unsigned vertex = i * 4;
        const unsigned index = i * 6;
        m_pIndices[index + 0] = static_cast<std::uint16_t>(vertex + 0);
        m_pIndices[index + 1] = static_cast<std::uint16_t>(vertex + 1);
        m_pIndices[index + 2] = static_cast<std::uint16_t>(vertex + 2);
        m_pIndices[index + 3] = static_cast<std::uint16_t>(vertex + 3);
        m_pIndices[index + 4] = static_cast<std::uint16_t>(vertex + 2);
        m_pIndices[index + 5] = static_cast<std::uint16_t>(vertex + 1);
    }
}

void CCParticleSystemQuad::updateQuadWithParticle(unsigned particleIndex) {
    const auto& particle = m_pParticles[particleIndex];
    auto& quad = m_pQuads[particleIndex].vertices;
    quad = {
        particle.x - 0.5f, particle.y - 0.5f,
        particle.x + 0.5f, particle.y - 0.5f,
        particle.x - 0.5f, particle.y + 0.5f,
        particle.x + 0.5f, particle.y + 0.5f,
    };
}

void CCParticleSystemQuad::postStep() {
    // Represents the source's updated quad data / VBO upload stage.
    m_uploadedQuadCount = activeParticles();
}

} // namespace cocos2d
