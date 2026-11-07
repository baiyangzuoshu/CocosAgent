#include <stdbool.h>
#include <stdio.h>

int main(void)
{
    int score = 0;
    int hit_count = 3;
    int points_per_hit = 15;

    for (int hit = 0; hit < hit_count; ++hit) {
        score += points_per_hit;
    }

    char rank = 'C';
    if (score >= 45) {
        rank = 'A';
    } else if (score >= 30) {
        rank = 'B';
    }

    double frame_interval = 1.0 / 60.0;
    bool has_score = score > 0;

    printf("score: %d\n", score);
    printf("rank: %c\n", rank);
    printf("frame interval: %.3f seconds\n", frame_interval);

    if (has_score) {
        puts("status: active");
    } else {
        puts("status: inactive");
    }

    return 0;
}
