/*
 * Icy Tower 1.0 - WebAssembly Core Physics & State Simulation
 * Reverse engineered from icytower.exe (Ghidra / REA MCP)
 *
 * Exact constants:
 * - Left wall: X = 85.0
 * - Right wall: X = 555.0
 * - Ground friction: vx *= 0.9
 * - Turnaround traction: vx *= 0.7
 * - Horizontal accel: 0.3 per frame
 * - Max horizontal speed: 12.0
 * - Gravity: 0.8 per frame
 * - Max fall speed: 12.0
 * - Jump velocity: vy = -max(12.0, abs(2 * vx))
 * - Wall bounce: vx = -vx * 0.9. If |vx| > 4.0, Harold spins!
 */

#define MAX_PLATFORMS 64
#define TILE_SIZE 16.0f
#define LEFT_WALL 85.0f
#define RIGHT_WALL 555.0f

// Sound event bitflags
#define SFX_JUMP_LO       (1 << 0)
#define SFX_JUMP_MID      (1 << 1)
#define SFX_JUMP_HI       (1 << 2)
#define SFX_STEP          (1 << 3)
#define SFX_EDGE          (1 << 4)
#define SFX_BOUNCE        (1 << 5)
#define SFX_HURRYUP       (1 << 6)
#define SFX_FALLING       (1 << 7)
#define SFX_SPLAT         (1 << 8)
#define SFX_COMBO_GOOD    (1 << 9)
#define SFX_COMBO_SWEET   (1 << 10)
#define SFX_COMBO_GREAT   (1 << 11)
#define SFX_COMBO_WOW     (1 << 12)
#define SFX_COMBO_AMAZING (1 << 13)
#define SFX_COMBO_EXTREME (1 << 14)
#define SFX_CHEER         (1 << 15)
#define SFX_RING          (1 << 16)
#define SFX_GAMEOVER      (1 << 17)

typedef struct {
    int active;
    int floor_num;
    float y;
    int tile_start;
    int tile_end;
    int type; // 0: ice, 1: wood, 2: cloud, 3: bone
} Platform;

typedef struct {
    float x;
    float y;
    float vx;
    float vy;
    int state;       // 0: ground, 1: jumping up, 2: falling down
    int facing;      // 0: left, 1: right
    int spin;        // >0: spinning clockwise, <0: counter-clockwise, 0: normal
    float spin_angle;// rotation angle in radians
    int on_edge;     // 1 if balancing on platform edge
    int current_plat_idx; // index of platform currently standing on (-1 if airborne)
    int anim_frame;
    int anim_timer;
} Player;

typedef struct {
    Player player;
    Platform platforms[MAX_PLATFORMS];
    int platform_count;
    int next_floor_gen;
    
    float camera_y;
    float clock_timer;
    float clock_speed;
    int hurry_state;
    int hurry_timer;
    
    int score;
    int highest_floor;
    int current_floor;
    
    // Combo system
    int combo_floors;
    int combo_count;
    int combo_timer;
    int combo_banner_type; // 0..5 or -1
    int combo_banner_timer;
    
    int sound_events;
    int game_over;
    int game_over_timer;
    unsigned int rng_state;
} GameState;

static GameState g_game;

// Simple LCG PRNG matching Allegro / MSVC rand()
static unsigned int rand_next(void) {
    g_game.rng_state = g_game.rng_state * 214013u + 2531011u;
    return (g_game.rng_state >> 16) & 0x7fff;
}

static float abs_f(float val) {
    return val < 0.0f ? -val : val;
}

static float max_f(float a, float b) {
    return a > b ? a : b;
}

static float min_f(float a, float b) {
    return a < b ? a : b;
}

static void trigger_sfx(int sfx_flag) {
    g_game.sound_events |= sfx_flag;
}

// Generate new platforms up to camera view + buffer
static void generate_platforms_ahead(void) {
    float target_y = g_game.camera_y - 300.0f;
    
    while (1) {
        // Find highest existing platform Y
        float highest_y = 480.0f;
        int found = 0;
        for (int i = 0; i < MAX_PLATFORMS; i++) {
            if (g_game.platforms[i].active) {
                if (!found || g_game.platforms[i].y < highest_y) {
                    highest_y = g_game.platforms[i].y;
                    found = 1;
                }
            }
        }
        
        if (highest_y <= target_y) break;
        
        int slot = -1;
        for (int i = 0; i < MAX_PLATFORMS; i++) {
            if (!g_game.platforms[i].active) {
                slot = i;
                break;
            }
        }
        if (slot == -1) break;
        
        int floor_num = g_game.next_floor_gen++;
        float plat_y = 400.0f - floor_num * 80.0f; // 80px distance between floors
        int theme = (floor_num / 100) % 4;
        
        Platform* p = &g_game.platforms[slot];
        p->active = 1;
        p->floor_num = floor_num;
        p->y = plat_y;
        p->type = theme;
        
        if (floor_num == 0 || (floor_num % 50 == 0)) {
            // Full width floor (floor 0 and every 50 floors, extends behind side walls)
            p->tile_start = 0;
            p->tile_end = 40;
        } else {
            // Formula from FUN_00404ff0:
            // Inner playfield between walls (x=75..565) spans tiles 5..34
            int max_len = 15 - (int)min_f((float)(floor_num / 50), 9.0f);
            if (max_len < 6) max_len = 6;
            int length = (rand_next() % max_len) + 5;
            if (length > 24) length = 24;
            int max_start = 35 - length;
            if (max_start < 6) max_start = 6;
            int start = (rand_next() % (max_start - 5)) + 5;
            
            p->tile_start = start;
            p->tile_end = start + length;
        }
    }
}

// Find if falling player hits a platform
static int find_landing_platform(float px, float py, float prev_py) {
    for (int i = 0; i < MAX_PLATFORMS; i++) {
        Platform* p = &g_game.platforms[i];
        if (!p->active) continue;
        
        float plat_left = p->tile_start * TILE_SIZE - 4.0f;
        float plat_right = (p->tile_end + 1) * TILE_SIZE + 4.0f;
        
        // Foot horizontal contact: foot spans [px - 10, px + 10]
        if ((px + 10.0f >= plat_left) && (px - 10.0f <= plat_right)) {
            // Foot was above or at platform on previous frame, and is at or slightly below platform now
            if (prev_py <= p->y + 2.0f && py >= p->y - 4.0f && py <= p->y + 16.0f) {
                return i;
            }
        }
    }
    return -1;
}

__attribute__((export_name("init_game")))
void init_game(unsigned int seed, int start_floor) {
    g_game.rng_state = seed ? seed : 123456789u;
    
    g_game.player.x = 320.0f;
    g_game.player.y = 400.0f;
    g_game.player.vx = 0.0f;
    g_game.player.vy = 0.0f;
    g_game.player.state = 0;
    g_game.player.facing = 1;
    g_game.player.spin = 0;
    g_game.player.spin_angle = 0.0f;
    g_game.player.on_edge = 0;
    g_game.player.current_plat_idx = 0;
    g_game.player.anim_frame = 0;
    g_game.player.anim_timer = 0;
    
    for (int i = 0; i < MAX_PLATFORMS; i++) {
        g_game.platforms[i].active = 0;
    }
    
    g_game.next_floor_gen = 0;
    g_game.highest_floor = 0;
    g_game.current_floor = 0;
    g_game.score = 0;
    
    g_game.camera_y = 200.0f;
    g_game.clock_timer = 0.0f;
    g_game.clock_speed = 0.0f;
    g_game.hurry_state = 0;
    g_game.hurry_timer = 0;
    
    g_game.combo_floors = 0;
    g_game.combo_count = 0;
    g_game.combo_timer = 0;
    g_game.combo_banner_type = -1;
    g_game.combo_banner_timer = 0;
    
    g_game.sound_events = 0;
    g_game.game_over = 0;
    g_game.game_over_timer = 0;
    
    generate_platforms_ahead();
}

__attribute__((export_name("update_physics")))
void update_physics(int input_left, int input_right, int input_jump) {
    g_game.sound_events = 0;
    
    if (g_game.game_over) {
        g_game.game_over_timer++;
        return;
    }
    
    Player* p = &g_game.player;
    float prev_y = p->y;
    
    // 1. Horizontal controls and friction (FUN_00402670)
    if (input_left) {
        p->facing = 0;
        if (p->vx > 0.0f) {
            p->vx *= 0.7f; // turnaround traction
        }
        p->vx -= 0.3f; // accel 0.3
    } else if (input_right) {
        p->facing = 1;
        if (p->vx < 0.0f) {
            p->vx *= 0.7f; // turnaround traction
        }
        p->vx += 0.3f; // accel 0.3
    } else {
        p->vx *= 0.9f; // ground & air damping
        if (abs_f(p->vx) < 0.05f) p->vx = 0.0f;
    }
    
    // Clamp horizontal speed: [-12.0, 12.0]
    p->vx = min_f(12.0f, max_f(-12.0f, p->vx));
    
    // 2. Jump handling (FUN_00406800 & FUN_00402610)
    if (input_jump && p->state == 0) {
        p->state = 1; // jumping up
        p->current_plat_idx = -1;
        p->on_edge = 0;
        
        // Jump formula from Ghidra: vy = -max(12.0, abs(2 * vx))
        float jump_power = max_f(12.0f, abs_f(2.0f * p->vx));
        p->vy = -jump_power;
        
        if (p->vy < -22.0f) {
            trigger_sfx(SFX_JUMP_HI);
            p->spin = p->facing ? 1 : -1;
        } else if (p->vy < -15.0f) {
            trigger_sfx(SFX_JUMP_MID);
        } else {
            trigger_sfx(SFX_JUMP_LO);
        }
    }
    
    // 3. Gravity and state transition (FUN_00406670)
    if (p->state != 0) {
        p->vy += 0.8f; // gravity = 0.8
        if (p->state == 1 && p->vy > 0.0f) {
            p->state = 2; // falling down
        }
    } else {
        p->vy = 0.0f;
    }
    
    // Clamp vertical velocity: max fall speed 12.0
    p->vy = min_f(12.0f, max_f(-100.0f, p->vy));
    
    // 4. Position update
    p->x += p->vx;
    p->y += p->vy;
    
    // 5. Wall bounce and collision (FUN_00406670)
    if (p->x > RIGHT_WALL) {
        p->x = RIGHT_WALL;
        p->vx = p->vx * -0.9f; // bounce restitution 0.9
        p->facing = 0;
        trigger_sfx(SFX_BOUNCE);
        if (abs_f(p->vx) > 4.0f) {
            p->spin = -1; // spin CCW
        }
    } else if (p->x < LEFT_WALL) {
        p->x = LEFT_WALL;
        p->vx = p->vx * -0.9f; // bounce restitution 0.9
        p->facing = 1;
        trigger_sfx(SFX_BOUNCE);
        if (abs_f(p->vx) > 4.0f) {
            p->spin = 1; // spin CW
        }
    }
    
    // Update spin rotation
    if (p->spin != 0) {
        p->spin_angle += (p->spin > 0 ? 0.35f : -0.35f);
        if (p->state == 0) {
            p->spin = 0;
            p->spin_angle = 0.0f;
        }
    } else {
        p->spin_angle = 0.0f;
    }
    
    // 6. Platform support & landing collision
    if (p->state == 0) {
        // Player is currently on ground. Verify that platform still supports player!
        int plat_idx = p->current_plat_idx;
        int still_supported = 0;
        if (plat_idx >= 0 && plat_idx < MAX_PLATFORMS && g_game.platforms[plat_idx].active) {
            Platform* cur_p = &g_game.platforms[plat_idx];
            float plat_left = cur_p->tile_start * TILE_SIZE - 4.0f;
            float plat_right = (cur_p->tile_end + 1) * TILE_SIZE + 4.0f;
            
            if ((p->x + 10.0f >= plat_left) && (p->x - 10.0f <= plat_right)) {
                still_supported = 1;
                p->y = cur_p->y; // Lock solidly to platform height
                p->vy = 0.0f;
                
                // Edge wobble check (skip on full-width floors)
                if (cur_p->tile_start > 0 && (abs_f(p->x - plat_left) < 12.0f || abs_f(p->x - plat_right) < 12.0f)) {
                    if (!p->on_edge) {
                        p->on_edge = 1;
                        trigger_sfx(SFX_EDGE);
                    }
                } else {
                    p->on_edge = 0;
                }
            }
        }
        
        if (!still_supported) {
            // Walked off the platform ledge!
            p->state = 2; // start falling
            p->current_plat_idx = -1;
            p->on_edge = 0;
        }
    } else if (p->vy >= 0.0f) {
        // Player is in air and descending (falling) -> check for platform landings
        int landed_idx = find_landing_platform(p->x, p->y, prev_y);
        if (landed_idx >= 0) {
            Platform* landed = &g_game.platforms[landed_idx];
            p->y = landed->y;
            p->vy = 0.0f;
            p->state = 0; // successfully landed
            p->current_plat_idx = landed_idx;
            p->spin = 0;
            p->spin_angle = 0.0f;
            trigger_sfx(SFX_STEP);
            
            int new_floor = landed->floor_num;
            
            // Edge wobble check
            float plat_left = landed->tile_start * TILE_SIZE - 4.0f;
            float plat_right = (landed->tile_end + 1) * TILE_SIZE + 4.0f;
            if (landed->tile_start > 0 && (abs_f(p->x - plat_left) < 12.0f || abs_f(p->x - plat_right) < 12.0f)) {
                p->on_edge = 1;
                trigger_sfx(SFX_EDGE);
            } else {
                p->on_edge = 0;
            }
            
            // Combo evaluation (FUN_004034a0 & FUN_004024f0)
            if (new_floor > g_game.current_floor) {
                int jumped_floors = new_floor - g_game.current_floor;
                if (jumped_floors >= 2) {
                    if (g_game.combo_timer > 0) {
                        g_game.combo_count++;
                        g_game.combo_floors += jumped_floors;
                    } else {
                        g_game.combo_count = 1;
                        g_game.combo_floors = jumped_floors;
                    }
                    g_game.combo_timer = 100; // 100 frames combo timeout
                } else {
                    if (g_game.combo_timer > 0) {
                        g_game.combo_timer = 1; // single step ends combo
                    }
                }
                g_game.current_floor = new_floor;
                if (new_floor > g_game.highest_floor) {
                    g_game.highest_floor = new_floor;
                }
            }
        }
    }
    
    // Combo timer decay & award
    if (g_game.combo_timer > 0) {
        g_game.combo_timer--;
        if (g_game.combo_timer == 0 && g_game.combo_floors >= 2) {
            // Award combo score: floors^2
            int bonus = g_game.combo_floors * g_game.combo_floors;
            g_game.score += bonus;
            
            // Announce combo banner (FUN_004024f0)
            int c = g_game.combo_floors;
            int banner = 0;
            if (c < 7) {
                banner = 0; trigger_sfx(SFX_COMBO_GOOD);
            } else if (c < 15) {
                banner = 1; trigger_sfx(SFX_COMBO_SWEET);
            } else if (c < 25) {
                banner = 2; trigger_sfx(SFX_COMBO_GREAT);
            } else if (c < 35) {
                banner = 3; trigger_sfx(SFX_COMBO_WOW);
            } else if (c < 45) {
                banner = 4; trigger_sfx(SFX_COMBO_AMAZING);
            } else {
                banner = 5; trigger_sfx(SFX_COMBO_EXTREME);
            }
            g_game.combo_banner_type = banner;
            g_game.combo_banner_timer = 80;
            g_game.combo_floors = 0;
            g_game.combo_count = 0;
        }
    }
    
    if (g_game.combo_banner_timer > 0) {
        g_game.combo_banner_timer--;
        if (g_game.combo_banner_timer == 0) {
            g_game.combo_banner_type = -1;
        }
    }
    
    // 7. Camera follow & clock speed (FUN_004034a0)
    float screen_y = p->y - g_game.camera_y + 240.0f;
    if (screen_y < 160.0f) {
        float diff = 160.0f - screen_y;
        g_game.camera_y -= diff * 0.25f;
    }
    
    // Automatic clock scroll
    if (g_game.highest_floor >= 5) {
        if (g_game.clock_speed < 0.6f) {
            g_game.clock_speed = 0.6f;
        }
        g_game.clock_timer += 1.0f;
        
        // Increase speed at milestones
        if (g_game.clock_timer > 600.0f && g_game.hurry_state == 0) {
            g_game.hurry_state = 1;
            g_game.clock_speed = 1.1f;
            trigger_sfx(SFX_HURRYUP);
            trigger_sfx(SFX_RING);
        } else if (g_game.clock_timer > 1200.0f && g_game.hurry_state == 1) {
            g_game.hurry_state = 2;
            g_game.clock_speed = 1.7f;
            trigger_sfx(SFX_HURRYUP);
            trigger_sfx(SFX_RING);
        } else if (g_game.clock_timer > 2000.0f && g_game.hurry_state == 2) {
            g_game.hurry_state = 3;
            g_game.clock_speed = 2.5f;
            trigger_sfx(SFX_HURRYUP);
            trigger_sfx(SFX_RING);
        }
        
        g_game.camera_y -= g_game.clock_speed;
    }
    
    // Generate new platforms as camera moves
    generate_platforms_ahead();
    
    // Cull platforms far below camera
    float bottom_cull = g_game.camera_y + 350.0f;
    for (int i = 0; i < MAX_PLATFORMS; i++) {
        if (g_game.platforms[i].active && g_game.platforms[i].y > bottom_cull) {
            g_game.platforms[i].active = 0;
        }
    }
    
    // 8. Death / Abyss Check
    float screen_bottom = g_game.camera_y + 240.0f;
    if (p->y > screen_bottom + 40.0f) {
        g_game.game_over = 1;
        g_game.game_over_timer = 0;
        trigger_sfx(SFX_FALLING);
        trigger_sfx(SFX_SPLAT);
        trigger_sfx(SFX_GAMEOVER);
    }
    
    // Animation frame update
    p->anim_timer++;
    if (p->state == 0) {
        if (abs_f(p->vx) > 0.3f) {
            if (p->anim_timer % 5 == 0) {
                p->anim_frame = (p->anim_frame + 1) % 4;
            }
        } else {
            p->anim_frame = 0;
        }
    }
}

// Getters for JavaScript / TypeScript
__attribute__((export_name("get_player_x")))
float get_player_x(void) { return g_game.player.x; }

__attribute__((export_name("get_player_y")))
float get_player_y(void) { return g_game.player.y; }

__attribute__((export_name("get_player_vx")))
float get_player_vx(void) { return g_game.player.vx; }

__attribute__((export_name("get_player_vy")))
float get_player_vy(void) { return g_game.player.vy; }

__attribute__((export_name("get_player_state")))
int get_player_state(void) { return g_game.player.state; }

__attribute__((export_name("get_player_facing")))
int get_player_facing(void) { return g_game.player.facing; }

__attribute__((export_name("get_player_spin")))
float get_player_spin(void) { return g_game.player.spin_angle; }

__attribute__((export_name("get_player_on_edge")))
int get_player_on_edge(void) { return g_game.player.on_edge; }

__attribute__((export_name("get_player_anim_frame")))
int get_player_anim_frame(void) { return g_game.player.anim_frame; }

__attribute__((export_name("get_player_anim_timer")))
int get_player_anim_timer(void) { return g_game.player.anim_timer; }

__attribute__((export_name("get_camera_y")))
float get_camera_y(void) { return g_game.camera_y; }

__attribute__((export_name("get_clock_timer")))
float get_clock_timer(void) { return g_game.clock_timer; }

__attribute__((export_name("get_highest_floor")))
int get_highest_floor(void) { return g_game.highest_floor; }

__attribute__((export_name("get_current_floor")))
int get_current_floor(void) { return g_game.current_floor; }

__attribute__((export_name("get_score")))
int get_score(void) { return g_game.score + g_game.highest_floor * 10; }

__attribute__((export_name("get_combo_floors")))
int get_combo_floors(void) { return g_game.combo_floors; }

__attribute__((export_name("get_combo_timer")))
int get_combo_timer(void) { return g_game.combo_timer; }

__attribute__((export_name("get_combo_banner_type")))
int get_combo_banner_type(void) { return g_game.combo_banner_type; }

__attribute__((export_name("get_combo_banner_timer")))
int get_combo_banner_timer(void) { return g_game.combo_banner_timer; }

__attribute__((export_name("get_sound_events")))
int get_sound_events(void) { return g_game.sound_events; }

__attribute__((export_name("get_game_over")))
int get_game_over(void) { return g_game.game_over; }

__attribute__((export_name("get_platform_count")))
int get_platform_count(void) { return MAX_PLATFORMS; }

__attribute__((export_name("get_platform_active")))
int get_platform_active(int idx) {
    if (idx < 0 || idx >= MAX_PLATFORMS) return 0;
    return g_game.platforms[idx].active;
}

__attribute__((export_name("get_platform_floor")))
int get_platform_floor(int idx) {
    if (idx < 0 || idx >= MAX_PLATFORMS) return 0;
    return g_game.platforms[idx].floor_num;
}

__attribute__((export_name("get_platform_y")))
float get_platform_y(int idx) {
    if (idx < 0 || idx >= MAX_PLATFORMS) return 0.0f;
    return g_game.platforms[idx].y;
}

__attribute__((export_name("get_platform_start")))
int get_platform_start(int idx) {
    if (idx < 0 || idx >= MAX_PLATFORMS) return 0;
    return g_game.platforms[idx].tile_start;
}

__attribute__((export_name("get_platform_end")))
int get_platform_end(int idx) {
    if (idx < 0 || idx >= MAX_PLATFORMS) return 0;
    return g_game.platforms[idx].tile_end;
}

__attribute__((export_name("get_platform_type")))
int get_platform_type(int idx) {
    if (idx < 0 || idx >= MAX_PLATFORMS) return 0;
    return g_game.platforms[idx].type;
}
