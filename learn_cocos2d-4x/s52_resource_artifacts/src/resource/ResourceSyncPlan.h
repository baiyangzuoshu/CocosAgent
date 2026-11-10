#pragma once

#include <string>

namespace lesson {

struct ResourceSyncPlan {
    std::string target;
    std::string sourceRoot;
    std::string outputRoot;

    std::string syncCommand(const std::string& relativePath) const {
        return "sync_folder.py -s " + sourceRoot + " -d " + outputRoot + " (" + relativePath + ")";
    }
};

} // namespace lesson
