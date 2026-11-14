#pragma once
class CCGLProgram {
public:
 bool compile(const std::string& stage, const std::string& source) {
   const bool ok = source.find("void main") != std::string::npos;
   std::cout << "CCGLProgram compile " << stage << " = " << (ok ? "ok" : "failed") << "\n";
   if (stage == "vertex") _vertex = ok; else _fragment = ok; return ok;
 }
 bool link() { _linked = _vertex && _fragment; std::cout << "CCGLProgram link vertex + fragment = " << (_linked ? "ok" : "failed") << "\n"; return _linked; }
private: bool _vertex=false, _fragment=false, _linked=false;
};
class CCShaderCache {
public: CCGLProgram& addProgram(const std::string& key) { std::cout << "CCShaderCache key=" << key << "\n"; return _program; }
private: CCGLProgram _program;
};
