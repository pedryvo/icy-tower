import type { WasmPhysicsExports } from './types';
import hashedWasmUrl from './icytower_physics.wasm?url';

export class WasmPhysics {
  private instance: WasmPhysicsExports | null = null;

  async init(wasmUrl = hashedWasmUrl): Promise<void> {
    try {
      const response = await fetch(wasmUrl, { cache: 'no-store' });
      const buffer = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(buffer, {
        env: {}
      });
      this.instance = instance.exports as unknown as WasmPhysicsExports;
    } catch (err) {
      console.error('Failed to load WASM physics module:', err);
      throw err;
    }
  }

  get exports(): WasmPhysicsExports {
    if (!this.instance) {
      throw new Error('WASM module not initialized');
    }
    return this.instance;
  }
}
