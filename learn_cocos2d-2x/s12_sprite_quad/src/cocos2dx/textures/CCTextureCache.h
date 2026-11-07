#pragma once

#include <map>
#include <memory>
#include <string>

namespace cocos2d {

class CCTexture2D {
public:
    explicit CCTexture2D(const std::string& path) : _path(path) {}
    const std::string& path() const { return _path; }

private:
    std::string _path;
};

class CCTextureCache {
public:
    static CCTextureCache* sharedTextureCache();
    CCTexture2D* addImage(const char* path);

private:
    std::map<std::string, std::unique_ptr<CCTexture2D>> m_pTextures;
};

} // namespace cocos2d
