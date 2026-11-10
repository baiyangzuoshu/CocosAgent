#include "CCParticleSystem.h"

#include <utility>

namespace cocos2d {

bool ParticleData::init(int count) {
    maxCount = count;
    posx.assign(count, 0.0f);
    posy.assign(count, 0.0f);
    timeToLive.assign(count, 0.0f);
    return true;
}

FileUtils* FileUtils::getInstance() {
    static FileUtils instance;
    return &instance;
}

std::string FileUtils::fullPathForFilename(const std::string& path) const {
    return "Resources/" + path;
}

ParticleConfig FileUtils::getValueMapFromFile(const std::string&) const {
    return {64, 1.8f, 0, "spark.png"};
}

TextureCache* TextureCache::getInstance() {
    static TextureCache cache;
    return &cache;
}

std::shared_ptr<Texture2D> TextureCache::addImage(const std::string& path) {
    return std::make_shared<Texture2D>(path);
}

bool ParticleSystem::initWithFile(const std::string& plistFile) {
    _plistFile = FileUtils::getInstance()->fullPathForFilename(plistFile);
    const ParticleConfig dictionary = FileUtils::getInstance()->getValueMapFromFile(_plistFile);
    const auto slash = plistFile.find_last_of('/');
    const std::string dirname = slash == std::string::npos ? "" : plistFile.substr(0, slash + 1);
    return initWithDictionary(dictionary, dirname);
}

bool ParticleSystem::initWithDictionary(const ParticleConfig& dictionary, const std::string& dirname) {
    if (!initWithTotalParticles(dictionary.maxParticles)) return false;
    _life = dictionary.life;
    _emitterMode = dictionary.emitterType;
    setTexture(TextureCache::getInstance()->addImage(dirname + dictionary.textureFileName));
    return static_cast<bool>(_texture);
}

bool ParticleSystem::initWithTotalParticles(int numberOfParticles) {
    _totalParticles = numberOfParticles;
    if (!_particleData.init(_totalParticles)) return false;
    return true;
}

void ParticleSystem::setTexture(const std::shared_ptr<Texture2D>& texture) {
    _texture = texture;
}

} // namespace cocos2d
