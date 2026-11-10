#pragma once

#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace cocos2d {

struct ParticleDictionary {
    ParticleDictionary() = default;
    ParticleDictionary(unsigned count, float particleLife, int mode, std::string texture)
    : maxParticles(count), life(particleLife), emitterType(mode), textureFileName(std::move(texture)) {}

    unsigned maxParticles = 0;
    float life = 0;
    int emitterType = 0;
    std::string textureFileName;
};

struct tCCParticle {
    float timeToLive = 0;
};

class CCTexture2D {
public:
    explicit CCTexture2D(std::string path) : path(std::move(path)) {}
    std::string path;
};

class CCFileUtils {
public:
    static std::string fullPathFromRelativePath(const std::string& path);
    static ParticleDictionary dictionaryWithContentsOfFileThreadSafe(const std::string& path);
};

class CCTextureCache {
public:
    static CCTextureCache& sharedTextureCache();
    std::shared_ptr<CCTexture2D> addImage(const std::string& path);
};

class CCParticleSystem {
public:
    virtual ~CCParticleSystem() = default;
    bool initWithFile(const char* plistFile);
    bool initWithDictionary(const ParticleDictionary& dictionary);
    virtual bool initWithTotalParticles(unsigned numberOfParticles);
    virtual void setTexture(const std::shared_ptr<CCTexture2D>& texture);

    unsigned totalParticles() const { return m_uTotalParticles; }
    unsigned particleDataSlots() const { return static_cast<unsigned>(m_pParticles.size()); }
    float life() const { return m_fLife; }
    int emitterMode() const { return m_nEmitterMode; }
    const std::shared_ptr<CCTexture2D>& texture() const { return m_pTexture; }

protected:
    unsigned m_uTotalParticles = 0;
    float m_fLife = 0;
    int m_nEmitterMode = 0;
    std::string m_sPlistFile;
    std::vector<tCCParticle> m_pParticles;
    std::shared_ptr<CCTexture2D> m_pTexture;
};

} // namespace cocos2d
