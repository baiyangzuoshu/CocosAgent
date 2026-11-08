#pragma once

#include <string>

namespace cocos2d {

class CCFileUtils {
public:
    static CCFileUtils* sharedFileUtils();
    std::string fullPathForFilename(const char* path) const;
};

} // namespace cocos2d
