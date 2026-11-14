#pragma once
namespace backend {
struct UniformLocation { std::size_t offset; };
class ProgramState { public: explicit ProgramState(UniformLocation loc):_location(loc),_data(4,0.0f){} void setUniform(const float* rgba){std::memcpy(_data.data()+_location.offset,rgba,4*sizeof(float));std::cout<<"copy vec4 into fragment Uniform buffer at offset "<<_location.offset<<"\n";} float read(std::size_t i)const{return _data[_location.offset+i];} private:UniformLocation _location;std::vector<float> _data;};
}
