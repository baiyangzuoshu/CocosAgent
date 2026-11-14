#pragma once
class GLProgram {
public:
 bool compileShader(const std::string& stage, const std::string& source) { bool ok=source.find("void main")!=std::string::npos; std::cout << "GLProgram compile "<<stage<<" = "<<(ok?"ok":"failed")<<"\n"; if(stage=="vertex")_vertex=ok;else _fragment=ok;return ok;}
 bool link() { bool ok=_vertex&&_fragment; std::cout<<"GLProgram link = "<<(ok?"ok":"failed")<<"\n";return ok;}
private: bool _vertex=false,_fragment=false;
};
class GLProgramCache { public: GLProgram& get(const std::string& key){std::cout<<"GLProgramCache key="<<key<<"\n";return _program;} private: GLProgram _program;};
