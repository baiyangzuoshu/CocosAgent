#pragma once
struct UniformValue { float r,g,b,a; UniformValue(float r_=0,float g_=0,float b_=0,float a_=0):r(r_),g(g_),b(b_),a(a_){} };
class GLProgramState { public: void setUniformVec4(const std::string& name,UniformValue v){_name=name;_value=v;std::cout<<"store "<<name<<" in GLProgramState\n";} void apply(){std::cout<<"GLProgramState apply -> glUniform4f("<<_name<<", "<<_value.r<<","<<_value.g<<","<<_value.b<<","<<_value.a<<")\n";} private: std::string _name;UniformValue _value;};
class Pass { public: explicit Pass(GLProgramState& s):_state(s){} void bind(){std::cout<<"Pass::bind\n";_state.apply();} private:GLProgramState& _state;};
