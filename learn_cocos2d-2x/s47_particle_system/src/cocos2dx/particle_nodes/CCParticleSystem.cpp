#include "CCParticleSystem.h"

#include <utility>

namespace cocos2d {

std::string CCFileUtils::fullPathForFilename(const std::string& path) {
    return "resources/" + path;
}

ParticleDictionary CCFileUtils::getValueMapFromFile(const std::string&) {
    return {48, 2.0f, 0, "spark.png"};
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
    m_nEmitterMode = dictionary.emitterType;
    setTexture(CCTextureCache::sharedTextureCache()->addImage(dirname + dictionary.textureFileName));
    return static_cast<bool>(m_pTexture);
}

bool CCParticleSystem::initWithTotalParticles(unsigned numberOfParticles) {
    m_uTotalParticles = numberOfParticles;
    m_pParticles.assign(numberOfParticles, tCCParticle{});
    m_uAllocatedParticles = numberOfParticles;
    return true;
}

void CCParticleSystem::setTexture(const std::shared_ptr<CCTexture2D>& texture) {
    m_pTexture = texture;
}

} // namespace cocos2d
