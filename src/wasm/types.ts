export interface WasmPhysicsExports {
  memory: WebAssembly.Memory;
  init_game(seed: number, startFloor: number): void;
  update_physics(inputLeft: number, inputRight: number, inputJump: number): void;
  get_player_x(): number;
  get_player_y(): number;
  get_player_vx(): number;
  get_player_vy(): number;
  get_player_state(): number;
  get_player_facing(): number;
  get_player_spin(): number;
  get_player_on_edge(): number;
  get_player_anim_frame(): number;
  get_camera_y(): number;
  get_clock_timer(): number;
  get_highest_floor(): number;
  get_current_floor(): number;
  get_score(): number;
  get_combo_floors(): number;
  get_combo_timer(): number;
  get_combo_banner_type(): number;
  get_combo_banner_timer(): number;
  get_sound_events(): number;
  get_game_over(): number;
  get_platform_count(): number;
  get_platform_active(idx: number): number;
  get_platform_floor(idx: number): number;
  get_platform_y(idx: number): number;
  get_platform_start(idx: number): number;
  get_platform_end(idx: number): number;
  get_platform_type(idx: number): number;
}

export const SFX_FLAGS = {
  JUMP_LO: 1 << 0,
  JUMP_MID: 1 << 1,
  JUMP_HI: 1 << 2,
  STEP: 1 << 3,
  EDGE: 1 << 4,
  BOUNCE: 1 << 5,
  HURRYUP: 1 << 6,
  FALLING: 1 << 7,
  SPLAT: 1 << 8,
  COMBO_GOOD: 1 << 9,
  COMBO_SWEET: 1 << 10,
  COMBO_GREAT: 1 << 11,
  COMBO_WOW: 1 << 12,
  COMBO_AMAZING: 1 << 13,
  COMBO_EXTREME: 1 << 14,
  CHEER: 1 << 15,
  RING: 1 << 16,
  GAMEOVER: 1 << 17
} as const;
