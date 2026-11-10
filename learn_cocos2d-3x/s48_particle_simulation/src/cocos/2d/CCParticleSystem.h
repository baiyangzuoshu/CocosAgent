#pragma once

#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace cocos2d {

struct ParticleConfig {
    ParticleConfig() = default;
    ParticleConfig(int count, float particleLife, float rate, float particleSpeed, float gravity,
                   int mode, std::string texture)
    : maxParticles(count), life(particleLife), emissionRate(rate), speed(particleSpeed),
      gravityY(gravity), emitterType(mode), textureFileName(std::move(texture)) {}

    int maxParticles = 0;
    float life = 0;
    float emissionRate = 0;
    float speed = 0;
    float gravityY = 0;
    int emitterType = 0;
    std::string textureFileName;
};

class ParticleData {
public:
    bool init(int count);
    int maxCount = 0;
    std::vector<float> posx;
    std::vector<float> posy;
    std::vector<float> dirX;
    std::vector<float> dirY;
    std::vector<float> timeToLive;
};

class Texture2D {
public:
    explicit Texture2D(std::string name) : name(std::move(name)) {}
    std::string name;

};

class FileUtils {
public:
    static FileUtils* getInstance();
    std::string fullPathForFilename(const std::string& path) const;
    ParticleConfig getValueMapFromFile(const std::string& path) const;
};

class TextureCache {
public:
    static TextureCache* getInstance();
    std::shared_ptr<Texture2D> addImage(const std::string& path);
};

class ParticleSystem {
public:
    virtual ~ParticleSystem() = default;
    bool initWithFile(const std::string& plistFile);
    bool initWithDictionary(const ParticleConfig& dictionary, const std::string& dirname);
    virtual bool initWithTotalParticles(int numberOfParticles);
    virtual void setTexture(const std::shared_ptr<Texture2D>& texture);
    void addParticles(int count);
    void update(float dt);

    int totalParticles() const { return _totalParticles; }
    int allocatedParticles() const { return _particleData.maxCount; }
    int activeParticles() const { return _particleCount; }
    float life() const { return _life; }
    float emissionRate() const { return _emissionRate; }
    int emitterMode() const { return _emitterMode; }
    const ParticleData& particleData() const { return _particleData; }
    const std::shared_ptr<Texture2D>& texture() const { return _texture; }

protected:
    int _totalParticles = 0;
    int _particleCount = 0;
    float _life = 0;
    float _emissionRate = 0;
    float _emitCounter = 0;
    float _speed = 0;
    float _gravityY = 0;
    bool _isActive = true;
    int _emitterMode = 0;
    std::string _plistFile;
    ParticleData _particleData;
    std::shared_ptr<Texture2D> _texture;
};

} // namespace cocos2d
