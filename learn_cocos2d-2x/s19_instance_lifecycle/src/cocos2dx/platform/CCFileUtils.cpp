#include "cocos2dx/platform/CCFileUtils.h"

namespace cocos2d {

CCFileUtils* CCFileUtils::sharedFileUtils() {
    static CCFileUtils fileUtils;
    return &fileUtils;
}

std::string CCFileUtils::fullPathForFilename(const char* path) const {
    if (!path || !*path) return "";
    return std::string("Resources/") + path;
}

} // namespace cocos2d
