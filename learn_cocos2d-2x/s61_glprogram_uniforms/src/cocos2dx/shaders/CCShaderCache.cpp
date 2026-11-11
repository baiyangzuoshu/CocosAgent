#include "CCShaderCache.h"

#include <iostream>
#include <utility>

void CCShaderCache::loadDefaultShaders() {
    std::unique_ptr<CCGLProgram> program(new CCGLProgram());
    program->initWithVertexShaderByteArray("attribute vec2 a_position;", "uniform vec4 u_tint;");
    program->addAttribute("a_position", 0);
    program->link();
    program->updateUniforms();
    m_programs["sprite-tint"] = std::move(program);
    std::cout << "CCShaderCache stored sprite-tint\n";
}

CCGLProgram* CCShaderCache::programForKey(const std::string& key) const {
    const auto found = m_programs.find(key);
    return found == m_programs.end() ? nullptr : found->second.get();
}
