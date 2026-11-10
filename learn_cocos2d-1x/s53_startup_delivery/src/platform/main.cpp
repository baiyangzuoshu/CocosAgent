#include "CCApplication.h"
#include <iostream>

int main() {
    std::cout << "Linux native executable entry\n";
    return CCApplication::sharedApplication().run();
}
