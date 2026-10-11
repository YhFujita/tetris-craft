/**
 * input.js - キーボード・タッチスワイプ・オンスクリーンコントローラー入力管理
 * PC: 矢印キー、スペース/上キーで回転、DAS対応
 * スマホ: スワイプ操作（左右・下・タップ回転）＋ 画面下部バーチャルボタン
 */

class InputManager {
    constructor(game, canvas, sound) {
        this.game = game;
        this.canvas = canvas;
        this.sound = sound;

        // キー状態
        this.keys = new Map();
        this.dasTimers = new Map(); // key -> { delayTimer, repeatInterval }

        // DAS設定 (ミリ秒)
        this.DAS_DELAY = 140;      // 長押し認識までの初動遅延
        this.DAS_REPEAT = 38;      // 連続移動間隔
        this.SOFT_DROP_REPEAT = 45;

        // タッチ操作用状態
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchCurrentX = 0;
        this.touchCurrentY = 0;
        this.lastSwipeStepX = 0;
        this.lastSwipeStepY = 0;
        this.touchStartTime = 0;
        this.SWIPE_THRESHOLD_X = 22; // 左右1マス分移動に必要なピクセル幅
        this.SWIPE_THRESHOLD_Y = 28; // 下1マス分移動に必要なピクセル幅

        this.initKeyboard();
        this.initTouchGestures();
        this.initVirtualButtons();
    }

    vibrate(ms = 12) {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(ms);
            } catch (e) {}
        }
    }

    // ==========================================
    // PC キーボード入力
    // ==========================================
    initKeyboard() {
        window.addEventListener('keydown', (e) => {
            // テトリス操作キーの場合はブラウザ標準スクロールを防止
            const controlKeys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space', 'KeyW', 'KeyX', 'KeyZ', 'KeyC', 'Enter'];
            if (controlKeys.includes(e.code)) {
                e.preventDefault();
            }

            if (e.repeat) return; // ブラウザ既定のリピートは自前DASで代替

            this.handleKeyDown(e.code);
        });

        window.addEventListener('keyup', (e) => {
            this.handleKeyUp(e.code);
        });
    }

    handleKeyDown(code) {
        if (!this.game.isPlaying) return;

        // オーディオコンテキストの初期化/再開をトリガー
        if (this.sound) this.sound.init();

        switch (code) {
            case 'ArrowLeft':
                this.game.moveLeft();
                this.startDas('ArrowLeft', () => this.game.moveLeft(), this.DAS_DELAY, this.DAS_REPEAT);
                break;

            case 'ArrowRight':
                this.game.moveRight();
                this.startDas('ArrowRight', () => this.game.moveRight(), this.DAS_DELAY, this.DAS_REPEAT);
                break;

            case 'ArrowDown':
                this.game.moveDown();
                this.startDas('ArrowDown', () => this.game.moveDown(), 70, this.SOFT_DROP_REPEAT);
                break;

            // 上キー または スペースキーで回転 (ユーザー指定)
            case 'ArrowUp':
            case 'Space':
            case 'KeyX':
                this.game.rotate(1);
                break;

            case 'KeyZ':
                this.game.rotate(-1);
                break;

            case 'Enter':
            case 'KeyW':
                this.game.hardDrop();
                break;

            case 'KeyC':
            case 'ShiftLeft':
            case 'ShiftRight':
                this.game.hold();
                break;

            case 'KeyP':
            case 'Escape':
                this.game.pause();
                break;
        }
    }

    handleKeyUp(code) {
        this.stopDas(code);
    }

    startDas(code, action, delay, repeat) {
        this.stopDas(code);

        const delayTimer = setTimeout(() => {
            const repeatInterval = setInterval(() => {
                if (this.game.isPlaying && !this.game.isPaused) {
                    action();
                }
            }, repeat);
            this.dasTimers.set(code, { delayTimer: null, repeatInterval });
        }, delay);

        this.dasTimers.set(code, { delayTimer, repeatInterval: null });
    }

    stopDas(code) {
        if (this.dasTimers.has(code)) {
            const t = this.dasTimers.get(code);
            if (t.delayTimer) clearTimeout(t.delayTimer);
            if (t.repeatInterval) clearInterval(t.repeatInterval);
            this.dasTimers.delete(code);
        }
    }

    clearAllDas() {
        this.dasTimers.forEach(t => {
            if (t.delayTimer) clearTimeout(t.delayTimer);
            if (t.repeatInterval) clearInterval(t.repeatInterval);
        });
        this.dasTimers.clear();
    }

    // ==========================================
    // スマートフォン タッチスワイプ操作
    // ==========================================
    initTouchGestures() {
        if (!this.canvas) return;

        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.touchStartX = touch.clientX;
                this.touchStartY = touch.clientY;
                this.touchCurrentX = touch.clientX;
                this.touchCurrentY = touch.clientY;
                this.lastSwipeStepX = touch.clientX;
                this.lastSwipeStepY = touch.clientY;
                this.touchStartTime = performance.now();

                if (this.sound) this.sound.init();
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.game.isPlaying || this.game.isPaused) return;
            e.preventDefault(); // 画面スクロール防止

            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.touchCurrentX = touch.clientX;
                this.touchCurrentY = touch.clientY;

                const deltaX = this.touchCurrentX - this.lastSwipeStepX;
                const deltaY = this.touchCurrentY - this.lastSwipeStepY;

                // 左右スワイプ判定（指を滑らせた量に応じて連続移動）
                if (Math.abs(deltaX) >= this.SWIPE_THRESHOLD_X) {
                    if (deltaX > 0) {
                        this.game.moveRight();
                    } else {
                        this.game.moveLeft();
                    }
                    this.vibrate(8);
                    this.lastSwipeStepX = this.touchCurrentX;
                }

                // 下スワイプ（ソフトドロップ）
                if (deltaY >= this.SWIPE_THRESHOLD_Y) {
                    this.game.moveDown();
                    this.lastSwipeStepY = this.touchCurrentY;
                }
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            if (!this.game.isPlaying || this.game.isPaused) return;

            const touchDuration = performance.now() - this.touchStartTime;
            const totalDx = this.touchCurrentX - this.touchStartX;
            const totalDy = this.touchCurrentY - this.touchStartY;
            const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

            // 1. タップ判定 (移動がほとんどなく短時間での離脱 → 回転)
            if (totalDist < 12 && touchDuration < 300) {
                this.game.rotate(1);
                this.vibrate(10);
            }
            // 2. 上方向への素早いフリック → ハードドロップ または 回転
            else if (totalDy < -50 && Math.abs(totalDx) < 40 && touchDuration < 250) {
                this.game.rotate(1);
                this.vibrate(12);
            }
        }, { passive: false });
    }

    // ==========================================
    // 画面下部オンスクリーンボタン (バーチャルパッド)
    // ==========================================
    initVirtualButtons() {
        const bindButton = (id, onAction, allowRepeat = false) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            let repeatInterval = null;
            let delayTimeout = null;

            const startAction = (e) => {
                if (e) e.preventDefault();
                if (this.sound) this.sound.init();
                this.vibrate(10);

                onAction();

                if (allowRepeat) {
                    delayTimeout = setTimeout(() => {
                        repeatInterval = setInterval(() => {
                            if (this.game.isPlaying && !this.game.isPaused) {
                                onAction();
                            }
                        }, 50);
                    }, 140);
                }
            };

            const stopAction = (e) => {
                if (e) e.preventDefault();
                if (delayTimeout) clearTimeout(delayTimeout);
                if (repeatInterval) clearInterval(repeatInterval);
            };

            btn.addEventListener('touchstart', startAction, { passive: false });
            btn.addEventListener('touchend', stopAction, { passive: false });
            btn.addEventListener('touchcancel', stopAction, { passive: false });

            // PCマウスクリック対応
            btn.addEventListener('mousedown', startAction);
            btn.addEventListener('mouseup', stopAction);
            btn.addEventListener('mouseleave', stopAction);
        };

        // ボタンの割り当て
        bindButton('btn-left', () => this.game.moveLeft(), true);
        bindButton('btn-right', () => this.game.moveRight(), true);
        bindButton('btn-down', () => this.game.moveDown(), true);
        bindButton('btn-rotate-cw', () => this.game.rotate(1), false);
        bindButton('btn-rotate-ccw', () => this.game.rotate(-1), false);
        bindButton('btn-hard-drop', () => this.game.hardDrop(), false);
        bindButton('btn-hold', () => this.game.hold(), false);
    }
}

window.InputManager = InputManager;
