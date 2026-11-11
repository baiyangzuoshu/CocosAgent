#pragma once

#include <string>
#include <unordered_map>

struct Uniform {
    std::string name;
    int location;
};

class GLProgram {
public:
    void link(const std::string& name, int location);
    const Uniform* getUniform(const std::string& name) const;
    int getUniformLocation(const std::string& name) const;
    const std::unordered_map<std::string, Uniform>& getUniforms() const { return m_uniforms; }
    void use();
    void setUniform1f(int location, float value);

private:
    std::unordered_map<std::string, Uniform> m_uniforms;
};
