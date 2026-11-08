#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    size_t count = 3;
    int *scores = malloc(count * sizeof *scores);
    if (scores == NULL) {
        fputs("could not allocate scores\n", stderr);
        return 1;
    }

    scores[0] = 12;
    scores[1] = 18;
    scores[2] = 15;

    int total = 0;
    printf("scores:");
    for (size_t i = 0; i < count; ++i) {
        printf(" %d", scores[i]);
        total += scores[i];
    }
    printf("\ntotal: %d\n", total);

    free(scores);
    scores = NULL;
    if (scores == NULL) {
        puts("memory: released");
    }

    return 0;
}
