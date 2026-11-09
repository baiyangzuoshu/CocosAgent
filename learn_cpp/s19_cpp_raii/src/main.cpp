#include <cstdio>
#include <fstream>
#include <iostream>
#include <string>

int main()
{
    const char* path = "/tmp/learn-cpp-s19-raii.txt";
    bool write_succeeded = false;

    {
        std::ofstream output{path};
        if (output) {
            output << "asset=forest\n";
            write_succeeded = static_cast<bool>(output);
            std::cout << "writer open: " << std::boolalpha << output.is_open()
                      << '\n';
        }
    }
    std::cout << "writer scope ended\n";

    if (!write_succeeded) {
        std::remove(path);
        std::cerr << "could not write temporary file\n";
        return 1;
    }

    std::string line;
    bool read_succeeded = false;
    {
        std::ifstream input{path};
        if (input && std::getline(input, line)) {
            read_succeeded = true;
        }
    }

    if (!read_succeeded) {
        std::remove(path);
        std::cerr << "could not read temporary file\n";
        return 1;
    }

    std::cout << "read back: " << line << '\n';
    if (std::remove(path) != 0) {
        std::cerr << "could not remove temporary file\n";
        return 1;
    }
    std::cout << "temporary file removed\n";

    return 0;
}
