#include <iostream>
#include <string>
#include <utility>

void inspect(const std::string& value)
{
    std::cout << "selected: const lvalue reference: " << value << '\n';
}

void inspect(std::string&& value)
{
    std::cout << "selected: rvalue reference: " << value << '\n';
}

int main()
{
    std::string sample{"Forest"};
    inspect(sample);
    inspect(std::move(sample));
    std::cout << "sample after inspect: " << sample << '\n';

    std::string source{"scene data"};
    std::string copied{source};
    std::string moved{std::move(source)};

    std::cout << "copy: " << copied << '\n';
    std::cout << "move: " << moved << '\n';
    return 0;
}
