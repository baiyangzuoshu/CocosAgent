#pragma once

#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace cocos2d {

struct ParticleDictionary {
    ParticleDictionary() = default;
    ParticleDictionary(unsigned count, float particleLife, float rate, float particleSpeed, float gravity,
                       int mode, std::string texture)
    : maxParticles(count), life(particleLife), emissionRate(rate), speed(particleSpeed),
      gravityY(gravity), emitterType(mode), textureFileName(std::move(texture)) {}

    unsigned maxParticles = 0;
    float life = 0;
    float emissionRate = 0;
    float speed = 0;
    float gravityY = 0;
    int emitterType = 0;
    std::string textureFileName;
};

struct tCCParticle {
    float x = 0;
    float y = 0;
    float dirX = 0;
    float dirY = 0;
    float timeToLive = 0;
};

class CCTexture2D {
public:
    explicit CCTexture2D(std::string path) : path(std::move(path)) {}
    std::string path;
};

class CCFileUtils {
public:
    static std::string fullPathForFilename(const std::string& path);
    static ParticleDictionary getValueMapFromFile(const std::string& path);
};

class CCTextureCache {
public:
    static CCTextureCache* sharedTextureCache();
    std::shared_ptr<CCTexture2D> addImage(const std::string& path);
};

class CCParticleSystem {
public:
    virtual ~CCParticleSystem() = default;
    bool initWithFile(const char* plistFile);
    bool initWithDictionary(const ParticleDictionary& dictionary, const std::string& dirname);
    virtual bool initWithTotalParticles(unsigned numberOfParticles);
    virtual void setTexture(const std::shared_ptr<CCTexture2D>& texture);
    void update(float dt);
    void stopSystem();
    bool finished() const { return m_bFinished; }
    bool removedOnFinish() const { return m_bRemovedOnFinish; }
    virtual void updateQuadWithParticle(unsigned particleIndex);
    virtual void postStep();

    unsigned totalParticles() const { return m_uTotalParticles; }
    unsigned activeParticles() const { return m_uParticleCount; }
    unsigned particleDataSlots() const { return static_cast<unsigned>(m_pParticles.size()); }
    float life() const { return m_fLife; }
    float emissionRate() const { return m_fEmissionRate; }
    int emitterMode() const { return m_nEmitterMode; }
    const tCCParticle& particleAt(unsigned index) const { return m_pParticles[index]; }
    const std::shared_ptr<CCTexture2D>& texture() const { return m_pTexture; }

protected:
    bool addParticle();
    void initParticle(tCCParticle& particle);

    unsigned m_uTotalParticles = 0;
    unsigned m_uParticleCount = 0;
    float m_fLife = 0;
    float m_fEmissionRate = 0;
    float m_fEmitCounter = 0;
    float m_fSpeed = 0;
    float m_fGravityY = 0;
    bool m_bIsActive = true;
    bool m_bAutoRemoveOnFinish = true;
    bool m_bFinished = false;
    bool m_bRemovedOnFinish = false;
    int m_nEmitterMode = 0;
    std::string m_sPlistFile;
    std::vector<tCCParticle> m_pParticles;
    std::shared_ptr<CCTexture2D> m_pTexture;
};

} // namespace cocos2d
