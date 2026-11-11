#pragma once

#include "CCGLProgram.h"

#include <memory>
#include <string>
#include <unordered_map>

class CCShaderCache {
public:
    void loadDefaultShaders();
    CCGLProgram* programForKey(const std::string& key) const;

private:
    std::unordered_map<std::string, std::unique_ptr<CCGLProgram>> m_programs;
};
