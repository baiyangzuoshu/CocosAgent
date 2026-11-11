#pragma once

#include <string>

class CCNode {
public:
    explicit CCNode(std::string name);
    void visit() const;

private:
    std::string _name;
};
