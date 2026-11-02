export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  pause: boolean;
  startOrRestart: boolean;
}

export class InputManager {
  private state: InputState = {
    left: false,
    right: false,
    jump: false,
    pause: false,
    startOrRestart: false
  };

  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;

  constructor() {
    this.bindKeyboard();
    this.bindTouchControls();
  }

  get input(): InputState {
    return this.state;
  }

  resetTriggers(): void {
    this.state.startOrRestart = false;
    this.state.pause = false;
  }

  private triggerHaptic(duration = 15): void {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {}
    }
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.state.left = true;
      }
      if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.state.right = true;
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.state.jump = true;
        this.state.startOrRestart = true;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        this.state.pause = true;
      }
      if (e.code === 'Enter') {
        this.state.startOrRestart = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.state.left = false;
      }
      if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.state.right = false;
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.state.jump = false;
      }
    });
  }

  private bindTouchControls(): void {
    // Setup on-screen buttons
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump = document.getElementById('btn-jump');

    const attachButton = (elem: HTMLElement | null, onPress: () => void, onRelease: () => void) => {
      if (!elem) return;
      const start = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerHaptic(20);
        onPress();
      };
      const end = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        onRelease();
      };
      elem.addEventListener('touchstart', start, { passive: false });
      elem.addEventListener('touchend', end, { passive: false });
      elem.addEventListener('touchcancel', end, { passive: false });
      elem.addEventListener('mousedown', start);
      elem.addEventListener('mouseup', end);
      elem.addEventListener('mouseleave', end);
    };

    attachButton(btnLeft, () => { this.state.left = true; }, () => { this.state.left = false; });
    attachButton(btnRight, () => { this.state.right = true; }, () => { this.state.right = false; });
    attachButton(
      btnJump,
      () => {
        this.state.jump = true;
        this.state.startOrRestart = true;
      },
      () => { this.state.jump = false; }
    );

    // Global touch/swipe gestures on screen
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (e.changedTouches.length > 0) {
        const dx = e.changedTouches[0].clientX - this.touchStartX;
        const dy = e.changedTouches[0].clientY - this.touchStartY;
        const dt = Date.now() - this.touchStartTime;

        // Quick tap triggers jump / start
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20 && dt < 250) {
          this.state.startOrRestart = true;
          this.triggerHaptic(15);
        }
        // Swipe up triggers jump
        else if (dy < -40 && Math.abs(dx) < 60) {
          this.state.jump = true;
          this.triggerHaptic(25);
          setTimeout(() => { this.state.jump = false; }, 180);
        }
      }
    }, { passive: true });
  }
}
