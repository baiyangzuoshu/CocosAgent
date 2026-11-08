#pragma once

#include <map>
#include <memory>
#include <string>

namespace cocos2d {

class CCTexture2D {
public:
    explicit CCTexture2D(const std::string& path, int width = 128, int height = 64)
        : _path(path), _width(width), _height(height) {}
    const std::string& path() const { return _path; }
    int pixelsWide() const { return _width; }
    int pixelsHigh() const { return _height; }

private:
    std::string _path;
    int _width;
    int _height;
};

class CCTextureCache {
public:
    static CCTextureCache* sharedTextureCache();
    CCTexture2D* addImage(const char* path);

private:
    std::map<std::string, std::unique_ptr<CCTexture2D>> m_pTextures;
};

} // namespace cocos2d
