#include <stddef.h>
#include <stdio.h>

void add_bonus(int *score, int bonus)
{
    if (score != NULL) {
        *score += bonus;
    }
}

int main(void)
{
    int score = 45;
    int *score_ptr = &score;

    printf("score before: %d\n", score);
    printf("score address: %p\n", (void *)score_ptr);
    printf("value through pointer: %d\n", *score_ptr);

    add_bonus(&score, 5);
    printf("score after: %d\n", score);

    add_bonus(NULL, 10);
    puts("null pointer call: skipped");

    return 0;
}
