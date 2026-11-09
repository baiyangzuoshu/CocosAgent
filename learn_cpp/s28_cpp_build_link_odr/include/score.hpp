#ifndef LEARN_CPP_S28_SCORE_HPP
#define LEARN_CPP_S28_SCORE_HPP

#include <string>

struct Score {
    std::string name;
    int base;
    int bonus;

    int total() const;
};

#endif
