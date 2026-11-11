#pragma once

#include <string>
#include <unordered_map>

class CCGLProgram {
public:
    void initWithVertexShaderByteArray(const std::string& vertex, const std::string& fragment);
    void addAttribute(const std::string& name, unsigned int index);
    void link();
    void updateUniforms();
    void use();
    int getUniformLocationForName(const std::string& name) const;
    void setUniformLocationWith4f(int location, float x, float y, float z, float w);

private:
    std::unordered_map<std::string, int> m_uniformLocations;
};
