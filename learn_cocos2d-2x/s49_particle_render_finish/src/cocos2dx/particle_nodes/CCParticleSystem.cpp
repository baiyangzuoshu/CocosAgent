#include "CCParticleSystem.h"

#include <algorithm>
#include <utility>

namespace cocos2d {

std::string CCFileUtils::fullPathForFilename(const std::string& path) {
    return "resources/" + path;
}

ParticleDictionary CCFileUtils::getValueMapFromFile(const std::string&) {
    return {4, 1.0f, 4.0f, 4.0f, -2.0f, 0, "spark.png"};
}

CCTextureCache* CCTextureCache::sharedTextureCache() {
    static CCTextureCache cache;
    return &cache;
}

std::shared_ptr<CCTexture2D> CCTextureCache::addImage(const std::string& path) {
    return std::make_shared<CCTexture2D>(path);
}

bool CCParticleSystem::initWithFile(const char* plistFile) {
    m_sPlistFile = CCFileUtils::fullPathForFilename(plistFile);
    const ParticleDictionary dictionary = CCFileUtils::getValueMapFromFile(m_sPlistFile);
    const std::string dirname = m_sPlistFile.substr(0, m_sPlistFile.find_last_of('/') + 1);
    return initWithDictionary(dictionary, dirname);
}

bool CCParticleSystem::initWithDictionary(const ParticleDictionary& dictionary, const std::string& dirname) {
    if (!initWithTotalParticles(dictionary.maxParticles)) return false;
    m_fLife = dictionary.life;
    m_fEmissionRate = dictionary.emissionRate;
    m_fSpeed = dictionary.speed;
    m_fGravityY = dictionary.gravityY;
    m_nEmitterMode = dictionary.emitterType;
    setTexture(CCTextureCache::sharedTextureCache()->addImage(dirname + dictionary.textureFileName));
    return static_cast<bool>(m_pTexture);
}

bool CCParticleSystem::initWithTotalParticles(unsigned numberOfParticles) {
    m_uTotalParticles = numberOfParticles;
    m_uParticleCount = 0;
    m_fEmitCounter = 0;
    m_bIsActive = true;
    m_pParticles.assign(numberOfParticles, tCCParticle{});
    return true;
}

bool CCParticleSystem::addParticle() {
    if (m_uParticleCount >= m_uTotalParticles) return false;
    initParticle(m_pParticles[m_uParticleCount]);
    ++m_uParticleCount;
    return true;
}

void CCParticleSystem::initParticle(tCCParticle& particle) {
    particle = tCCParticle{};
    particle.timeToLive = std::max(0.0f, m_fLife);
    particle.dirX = m_fSpeed;
}

void CCParticleSystem::update(float dt) {
    if (m_bIsActive && m_fEmissionRate > 0) {
        const float rate = 1.0f / m_fEmissionRate;
        if (m_uParticleCount < m_uTotalParticles) m_fEmitCounter += dt;
        while (m_uParticleCount < m_uTotalParticles && m_fEmitCounter > rate) {
            addParticle();
            m_fEmitCounter -= rate;
        }
    }

    unsigned particleIndex = 0;
    while (particleIndex < m_uParticleCount) {
        tCCParticle& particle = m_pParticles[particleIndex];
        particle.timeToLive -= dt;
        if (particle.timeToLive > 0) {
            particle.dirY += m_fGravityY * dt;
            particle.x += particle.dirX * dt;
            particle.y += particle.dirY * dt;
            updateQuadWithParticle(particleIndex);
            ++particleIndex;
        } else {
            const unsigned lastIndex = m_uParticleCount - 1;
            if (particleIndex != lastIndex) m_pParticles[particleIndex] = m_pParticles[lastIndex];
            --m_uParticleCount;
        }
    }

    postStep();
    if (!m_bIsActive && m_uParticleCount == 0) {
        m_bFinished = true;
        if (m_bAutoRemoveOnFinish) m_bRemovedOnFinish = true;
    }
}

void CCParticleSystem::stopSystem() {
    m_bIsActive = false;
    m_fEmitCounter = 0;
}

void CCParticleSystem::updateQuadWithParticle(unsigned) {}

void CCParticleSystem::postStep() {}

void CCParticleSystem::setTexture(const std::shared_ptr<CCTexture2D>& texture) {
    m_pTexture = texture;
}

} // namespace cocos2d
