#include "CCParticleSystem.h"

#include <utility>

namespace cocos2d {

std::string CCFileUtils::fullPathFromRelativePath(const std::string& path) {
    return "resources/" + path;
}

ParticleDictionary CCFileUtils::dictionaryWithContentsOfFileThreadSafe(const std::string&) {
    return {32, 1.25f, 0, "spark.png"};
}

CCTextureCache& CCTextureCache::sharedTextureCache() {
    static CCTextureCache cache;
    return cache;
}

std::shared_ptr<CCTexture2D> CCTextureCache::addImage(const std::string& path) {
    return std::make_shared<CCTexture2D>(path);
}

bool CCParticleSystem::initWithFile(const char* plistFile) {
    m_sPlistFile = CCFileUtils::fullPathFromRelativePath(plistFile);
    return initWithDictionary(CCFileUtils::dictionaryWithContentsOfFileThreadSafe(m_sPlistFile));
}

bool CCParticleSystem::initWithDictionary(const ParticleDictionary& dictionary) {
    if (!initWithTotalParticles(dictionary.maxParticles)) return false;
    m_fLife = dictionary.life;
    m_nEmitterMode = dictionary.emitterType;
    setTexture(CCTextureCache::sharedTextureCache().addImage(dictionary.textureFileName));
    return static_cast<bool>(m_pTexture);
}

bool CCParticleSystem::initWithTotalParticles(unsigned numberOfParticles) {
    m_uTotalParticles = numberOfParticles;
    m_pParticles.assign(numberOfParticles, tCCParticle{});
    return true;
}

void CCParticleSystem::setTexture(const std::shared_ptr<CCTexture2D>& texture) {
    m_pTexture = texture;
}

} // namespace cocos2d
