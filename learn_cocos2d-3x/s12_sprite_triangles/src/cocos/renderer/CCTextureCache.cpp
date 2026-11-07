#include "cocos/renderer/CCTextureCache.h"
#include "cocos/platform/CCFileUtils.h"

#include <iostream>

namespace cocos2d {

Texture2D* TextureCache::addImage(const std::string& path) {
    const std::string fullPath = FileUtils::getInstance()->fullPathForFilename(path);
    if (fullPath.empty()) return nullptr;

    const auto found = _textures.find(fullPath);
    if (found != _textures.end()) return found->second.get();

    Image image;
    if (!image.initWithImageFile(fullPath)) return nullptr;
    auto texture = std::unique_ptr<Texture2D>(new Texture2D());
    if (!texture->initWithImage(image)) return nullptr;

    std::cout << "decode " << fullPath << "\n";
    Texture2D* result = texture.get();
    _textures.emplace(fullPath, std::move(texture));
    return result;
}

} // namespace cocos2d
