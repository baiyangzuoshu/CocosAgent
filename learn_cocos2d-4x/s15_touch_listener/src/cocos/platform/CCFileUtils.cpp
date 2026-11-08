#include "cocos/platform/CCFileUtils.h"

namespace cocos2d {

FileUtils* FileUtils::getInstance() {
    static FileUtils fileUtils;
    return &fileUtils;
}

std::string FileUtils::fullPathForFilename(const std::string& path) const {
    if (path.empty()) return "";
    return "Resources/" + path;
}

} // namespace cocos2d
