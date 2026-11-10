#include "CCParticleSystemQuad.h"

namespace cocos2d {

std::unique_ptr<CCParticleSystemQuad> CCParticleSystemQuad::create(const char* plistFile) {
    std::unique_ptr<CCParticleSystemQuad> system(new CCParticleSystemQuad());
    if (!system->initWithFile(plistFile)) return nullptr;
    return system;
}

bool CCParticleSystemQuad::initWithTotalParticles(unsigned numberOfParticles) {
    if (!CCParticleSystem::initWithTotalParticles(numberOfParticles)) return false;
    if (!allocMemory()) return false;
    initIndices();
    setupVBO();
    return true;
}

bool CCParticleSystemQuad::allocMemory() {
    m_pQuads.assign(m_uTotalParticles, ccV2F_C4B_T2F_Quad{});
    m_pIndices.resize(m_uTotalParticles * 6);
    return true;
}

void CCParticleSystemQuad::setTexture(const std::shared_ptr<CCTexture2D>& texture) {
    setTextureWithRect(texture, CCRect{});
}

void CCParticleSystemQuad::setTextureWithRect(const std::shared_ptr<CCTexture2D>& texture, const CCRect&) {
    CCParticleSystem::setTexture(texture);
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

void CCParticleSystemQuad::setupVBO() {
    m_vboParticleSlots = m_uTotalParticles;
}

} // namespace cocos2d
