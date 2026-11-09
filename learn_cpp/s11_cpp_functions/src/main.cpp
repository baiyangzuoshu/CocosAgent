#include <iostream>

int add(int left, int right);
double add(double left, double right);
int calculate_score(int hit_count, int points_per_hit, int bonus = 0);

int main()
{
    int integer_sum = add(3, 4);
    double decimal_sum = add(1.5, 2.25);
    int default_bonus_score = calculate_score(3, 15);
    int explicit_bonus_score = calculate_score(3, 15, 5);

    std::cout << "integer sum: " << integer_sum << '\n';
    std::cout << "decimal sum: " << decimal_sum << '\n';
    std::cout << "score with default bonus: " << default_bonus_score << '\n';
    std::cout << "score with explicit bonus: " << explicit_bonus_score << '\n';

    return 0;
}

int add(int left, int right)
{
    return left + right;
}

double add(double left, double right)
{
    return left + right;
}

int calculate_score(int hit_count, int points_per_hit, int bonus)
{
    return hit_count * points_per_hit + bonus;
}
