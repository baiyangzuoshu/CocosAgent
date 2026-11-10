#pragma once

#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace cocos2d {

struct ParticleConfig {
    ParticleConfig() = default;
    ParticleConfig(int count, float particleLife, int mode, std::string texture)
    : maxParticles(count), life(particleLife), emitterType(mode), textureFileName(std::move(texture)) {}

    int maxParticles = 0;
    float life = 0;
    int emitterType = 0;
    std::string textureFileName;
};

class ParticleData {
public:
    bool init(int count);
    int maxCount = 0;
    std::vector<float> posx;
    std::vector<float> posy;
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

    int totalParticles() const { return _totalParticles; }
    int allocatedParticles() const { return _particleData.maxCount; }
    int activeParticles() const { return _particleCount; }
    float life() const { return _life; }
    int emitterMode() const { return _emitterMode; }
    const std::shared_ptr<Texture2D>& texture() const { return _texture; }

protected:
    int _totalParticles = 0;
    int _particleCount = 0;
    float _life = 0;
    int _emitterMode = 0;
    std::string _plistFile;
    ParticleData _particleData;
    std::shared_ptr<Texture2D> _texture;
};

} // namespace cocos2d
