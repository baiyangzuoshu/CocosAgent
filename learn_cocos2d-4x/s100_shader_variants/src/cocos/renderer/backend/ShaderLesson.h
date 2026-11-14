#pragma once
class ProgramCache {
public:
 std::string get(const std::string& name,const std::map<std::string,int>& defines) { std::string key=name; for(const auto& pair:defines) key += ":"+pair.first+"="+std::to_string(pair.second); auto old=_cache.find(key); if(old!=_cache.end()){std::cout<<"cache hit "<<key<<" -> cached backend Program\n";return old->second;} std::string id="program-"+std::to_string(_cache.size()+1);_cache[key]=id;std::cout<<"compile variant "<<key<<" with #define\n";return id; }
 std::size_t size()const{return _cache.size();}
private: std::map<std::string,std::string> _cache;
};
