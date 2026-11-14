#pragma once
namespace backend {
class ShaderModuleGL { public: bool compile(const std::string& stage,const std::string& source){bool ok=source.find("void main")!=std::string::npos;std::cout<<"ShaderModuleGL compile "<<stage<<" = "<<(ok?"ok":"failed")<<"\n";return ok;} };
class Program { public: bool link(ShaderModuleGL& module,const std::string& vertex,const std::string& fragment){bool ok=module.compile("vertex",vertex)&&module.compile("fragment",fragment);std::cout<<"backend::Program link = "<<(ok?"ok":"failed")<<"\n";return ok;} };
class ProgramCache { public: Program& get(const std::string& key){std::cout<<"ProgramCache key="<<key<<"\n";return _program;} private: Program _program;};
}
