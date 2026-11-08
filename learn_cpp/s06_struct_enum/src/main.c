#include <stddef.h>
#include <stdio.h>

typedef enum {
    ACTOR_IDLE,
    ACTOR_MOVING,
    ACTOR_DISABLED
} ActorState;

typedef struct {
    int health;
    int x;
    int y;
    ActorState state;
} Actor;

void apply_damage(Actor *actor, int damage)
{
    if (actor == NULL || damage <= 0) {
        return;
    }

    if (damage >= actor->health) {
        actor->health = 0;
        actor->state = ACTOR_DISABLED;
    } else {
        actor->health -= damage;
    }
}

int main(void)
{
    Actor hero = {100, 4, 7, ACTOR_IDLE};
    Actor *hero_ptr = &hero;

    printf("initial health: %d\n", hero.health);

    hero_ptr->x += 2;
    printf("position: (%d, %d)\n", hero.x, hero.y);

    apply_damage(&hero, 120);
    printf("health after damage: %d\n", hero.health);

    if (hero.state == ACTOR_DISABLED) {
        puts("state: disabled");
    } else {
        puts("state: active");
    }

    return 0;
}
