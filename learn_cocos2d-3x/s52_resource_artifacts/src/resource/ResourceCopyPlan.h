#pragma once

#include <string>

namespace lesson {

struct ResourceCopyPlan {
    std::string sourceRoot;
    std::string outputRoot;

    std::string destination(const std::string& relativePath) const {
        return outputRoot + "/" + relativePath;
    }
};

} // namespace lesson
