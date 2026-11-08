#include "cocos2dx/textures/CCTextureCache.h"
#include "cocos2dx/platform/CCFileUtils.h"

#include <iostream>

namespace cocos2d {

CCTextureCache* CCTextureCache::sharedTextureCache() {
    static CCTextureCache cache;
    return &cache;
}

CCTexture2D* CCTextureCache::addImage(const char* path) {
    if (!path) return nullptr;

    std::string normalizedPath = path;
    CCFileUtils::removeSuffixFromFile(normalizedPath);
    const std::string pathKey = CCFileUtils::fullPathFromRelativePath(normalizedPath.c_str());
    const auto found = m_pTextures.find(pathKey);
    if (found != m_pTextures.end()) return found->second.get();

    std::cout << "decode " << pathKey << "\n";
    auto texture = std::unique_ptr<CCTexture2D>(new CCTexture2D(pathKey));
    CCTexture2D* result = texture.get();
    m_pTextures.emplace(pathKey, std::move(texture));
    return result;
}

} // namespace cocos2d
