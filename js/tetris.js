/**
 * tetris.js - テトリス風ゲームのコアロジック
 * 7-bag, SRS風ウォールキック, ゴーストミノ, ホールド, スピードアップ/一定速度モード
 */

const BOARD_COLS = 10;
const BOARD_ROWS = 20;

// テトリミノの定義 (4x4 または 3x3 行列表現)
const TETROMINOES = {
    I: {
        id: 'I',
        shape: [
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        classicColor: '#00f0ff', // シアン
        woodWoodType: 'hinoki'   // 檜（明るい白木）
    },
    J: {
        id: 'J',
        shape: [
            [1, 0, 0],
            [1, 1, 1],
            [0, 0, 0]
        ],
        classicColor: '#2563eb', // ディープブルー
        woodWoodType: 'indigo'   // 藍染木
    },
    L: {
        id: 'L',
        shape: [
            [0, 0, 1],
            [1, 1, 1],
            [0, 0, 0]
        ],
        classicColor: '#f97316', // オレンジ
        woodWoodType: 'zelkova'  // 欅（ケヤキ・赤褐色）
    },
    O: {
        id: 'O',
        shape: [
            [1, 1],
            [1, 1]
        ],
        classicColor: '#eab308', // イエロー
        woodWoodType: 'oak'      // 楢（オーク・黄金木）
    },
    S: {
        id: 'S',
        shape: [
            [0, 1, 1],
            [1, 1, 0],
            [0, 0, 0]
        ],
        classicColor: '#22c55e', // ネオングリーン
        woodWoodType: 'bamboo'   // 竹・若草木
    },
    T: {
        id: 'T',
        shape: [
            [0, 1, 0],
            [1, 1, 1],
            [0, 0, 0]
        ],
        classicColor: '#a855f7', // パープル
        woodWoodType: 'walnut'   // ウォールナット（紫檀風深木）
    },
    Z: {
        id: 'Z',
        shape: [
            [1, 1, 0],
            [0, 1, 1],
            [0, 0, 0]
        ],
        classicColor: '#ef4444', // エレクトリックレッド
        woodWoodType: 'cherry'   // 桜（赤木）
    }
};

// SRS (Super Rotation System) ウォールキックデータ
const WALL_KICK_DATA = {
    normal: {
        '0->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        '1->0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
        '1->2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
        '2->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        '2->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        '3->2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        '3->0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        '0->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
    },
    I: {
        '0->1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
        '1->0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
        '1->2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
        '2->1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
        '2->3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
        '3->2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
        '3->0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
        '0->3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
    }
};

class TetrisGame {
    constructor() {
        this.board = this.createEmptyBoard();
        this.currentPiece = null;
        this.ghostY = 0;
        this.nextQueue = [];
        this.holdPiece = null;
        this.canHold = true;

        this.bag = [];

        // ゲーム状態
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.lines = 0;
        this.level = 1;
        this.mode = 'speed_up'; // 'speed_up' (徐々に加速) または 'constant' (速度固定)
        this.isGameOver = false;
        this.isPaused = false;
        this.isPlaying = false;

        // タイミング関連
        this.dropInterval = 1000;
        this.lastDropTime = 0;
        this.lockDelay = 500;
        this.lockTimer = null;
        this.lockResetCount = 0;
        this.maxLockResets = 15;

        // イベントコールバック
        this.onEvent = null;
    }

    createEmptyBoard() {
        return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
    }

    loadHighScore() {
        try {
            return parseInt(localStorage.getItem('tetris_high_score') || '0', 10);
        } catch (e) {
            return 0;
        }
    }

    saveHighScore() {
        try {
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('tetris_high_score', this.highScore.toString());
            }
        } catch (e) {}
    }

    setMode(mode) {
        this.mode = mode;
        this.updateDropInterval();
    }

    updateDropInterval() {
        if (this.mode === 'constant') {
            // 一定速度モード: 初心者〜中級者が落ち着いて遊べる快適な速度 (約 700ms)
            this.dropInterval = 700;
        } else {
            // 徐々に早くなるモード: レベル1(900ms)からレベル15+(約80ms)まで指数関数的に加速
            this.dropInterval = Math.max(80, Math.pow(0.8 - ((this.level - 1) * 0.007), this.level - 1) * 900);
        }
    }

    // ==========================================
    // 7-Bag ランダマイザー
    // ==========================================
    refillBag() {
        const pieces = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
        // Fisher-Yates シャッフル
        for (let i = pieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
        }
        this.bag.push(...pieces);
    }

    getNextPieceType() {
        if (this.bag.length <= 4) {
            this.refillBag();
        }
        return this.bag.shift();
    }

    initQueue() {
        this.bag = [];
        this.refillBag();
        this.refillBag();
        this.nextQueue = [];
        for (let i = 0; i < 4; i++) {
            this.nextQueue.push(this.getNextPieceType());
        }
    }

    spawnPiece(type = null) {
        const pieceType = type || this.nextQueue.shift();
        this.nextQueue.push(this.getNextPieceType());

        const proto = TETROMINOES[pieceType];
        // クローン
        const shape = proto.shape.map(row => [...row]);
        const size = shape.length;
        const x = Math.floor((BOARD_COLS - size) / 2);
        const y = pieceType === 'I' ? -1 : 0;

        this.currentPiece = {
            id: pieceType,
            shape: shape,
            x: x,
            y: y,
            rotation: 0,
            classicColor: proto.classicColor,
            woodWoodType: proto.woodWoodType
        };

        this.canHold = true;
        this.lockResetCount = 0;
        this.clearLockDelay();

        // スポーン時点で衝突していればゲームオーバー
        if (this.isColliding(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
            this.triggerGameOver();
            return false;
        }

        this.updateGhostY();
        return true;
    }

    // ==========================================
    // 衝突判定
    // ==========================================
    isColliding(targetX, targetY, shape) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const boardX = targetX + c;
                    const boardY = targetY + r;

                    // 左右および底面境界チェック
                    if (boardX < 0 || boardX >= BOARD_COLS || boardY >= BOARD_ROWS) {
                        return true;
                    }
                    // 天井より上は衝突とみなさない（盤面内のみチェック）
                    if (boardY >= 0 && this.board[boardY][boardX] !== null) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    updateGhostY() {
        if (!this.currentPiece) return;
        let gy = this.currentPiece.y;
        while (!this.isColliding(this.currentPiece.x, gy + 1, this.currentPiece.shape)) {
            gy++;
        }
        this.ghostY = gy;
    }

    // ==========================================
    // 移動・回転・ホールド操作
    // ==========================================

    moveLeft() {
        if (!this.isPlaying || this.isPaused || !this.currentPiece) return false;
        if (!this.isColliding(this.currentPiece.x - 1, this.currentPiece.y, this.currentPiece.shape)) {
            this.currentPiece.x--;
            this.handlePieceMoved();
            this.emit('move');
            return true;
        }
        return false;
    }

    moveRight() {
        if (!this.isPlaying || this.isPaused || !this.currentPiece) return false;
        if (!this.isColliding(this.currentPiece.x + 1, this.currentPiece.y, this.currentPiece.shape)) {
            this.currentPiece.x++;
            this.handlePieceMoved();
            this.emit('move');
            return true;
        }
        return false;
    }

    moveDown() {
        if (!this.isPlaying || this.isPaused || !this.currentPiece) return false;
        if (!this.isColliding(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
            this.currentPiece.y++;
            this.score += 1; // ソフトドロップ点数
            this.saveHighScore();
            this.clearLockDelay();
            this.updateGhostY();
            return true;
        } else {
            // 底に着地した場合はロック遅延を開始
            this.startLockDelay();
            return false;
        }
    }

    hardDrop() {
        if (!this.isPlaying || this.isPaused || !this.currentPiece) return;
        this.clearLockDelay();
        const dropDistance = this.ghostY - this.currentPiece.y;
        this.currentPiece.y = this.ghostY;
        this.score += dropDistance * 2; // ハードドロップ点数
        this.saveHighScore();

        this.emit('hardDrop', { dropDistance });
        this.lockPiece();
    }

    /**
     * 行列を回転 (dir: 1 = 時計回り, -1 = 反時計回り)
     */
    rotateMatrix(matrix, dir = 1) {
        const N = matrix.length;
        const result = Array.from({ length: N }, () => Array(N).fill(0));
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (dir === 1) {
                    result[c][N - 1 - r] = matrix[r][c];
                } else {
                    result[N - 1 - c][r] = matrix[r][c];
                }
            }
        }
        return result;
    }

    rotate(dir = 1) {
        if (!this.isPlaying || this.isPaused || !this.currentPiece) return false;
        if (this.currentPiece.id === 'O') return false; // Oミノは回転不要

        const rotated = this.rotateMatrix(this.currentPiece.shape, dir);
        const oldRot = this.currentPiece.rotation;
        const newRot = (oldRot + (dir === 1 ? 1 : 3)) % 4;
        const kickKey = `${oldRot}->${newRot}`;

        const kickTable = (this.currentPiece.id === 'I' ? WALL_KICK_DATA.I : WALL_KICK_DATA.normal)[kickKey] || [[0, 0]];

        // SRS ウォールキック試行
        for (const [kx, ky] of kickTable) {
            const testX = this.currentPiece.x + kx;
            // 数学座標系(ky上正)から盤面(ky下正)への変換
            const testY = this.currentPiece.y - ky;

            if (!this.isColliding(testX, testY, rotated)) {
                this.currentPiece.shape = rotated;
                this.currentPiece.x = testX;
                this.currentPiece.y = testY;
                this.currentPiece.rotation = newRot;

                this.handlePieceMoved();
                this.emit('rotate');
                return true;
            }
        }
        return false;
    }

    hold() {
        if (!this.isPlaying || this.isPaused || !this.currentPiece || !this.canHold) return false;

        const currentType = this.currentPiece.id;
        this.clearLockDelay();

        if (this.holdPiece === null) {
            this.holdPiece = currentType;
            this.spawnPiece();
        } else {
            const toSpawn = this.holdPiece;
            this.holdPiece = currentType;
            this.spawnPiece(toSpawn);
        }

        this.canHold = false;
        this.emit('hold');
        return true;
    }

    handlePieceMoved() {
        this.updateGhostY();
        // 接地している場合はロック遅延をリセット
        if (this.currentPiece.y === this.ghostY) {
            if (this.lockResetCount < this.maxLockResets) {
                this.lockResetCount++;
                this.clearLockDelay();
                this.startLockDelay();
            }
        } else {
            this.clearLockDelay();
        }
    }

    startLockDelay() {
        if (this.lockTimer !== null) return;
        this.lockTimer = setTimeout(() => {
            this.lockTimer = null;
            if (this.isPlaying && this.currentPiece && this.currentPiece.y === this.ghostY) {
                this.lockPiece();
            }
        }, this.lockDelay);
    }

    clearLockDelay() {
        if (this.lockTimer !== null) {
            clearTimeout(this.lockTimer);
            this.lockTimer = null;
        }
    }

    // ==========================================
    // ピースの固定 & ライン消去
    // ==========================================
    lockPiece() {
        if (!this.currentPiece) return;
        this.clearLockDelay();

        const { shape, x, y, id, classicColor, woodWoodType } = this.currentPiece;

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const boardY = y + r;
                    const boardX = x + c;
                    if (boardY >= 0 && boardY < BOARD_ROWS && boardX >= 0 && boardX < BOARD_COLS) {
                        this.board[boardY][boardX] = {
                            id,
                            classicColor,
                            woodWoodType
                        };
                    }
                }
            }
        }

        this.emit('lock', { x, y, id });
        this.currentPiece = null;

        // ライン消去チェック
        this.checkLineClears();
    }

    checkLineClears() {
        const clearedRows = [];
        for (let r = 0; r < BOARD_ROWS; r++) {
            if (this.board[r].every(cell => cell !== null)) {
                clearedRows.push(r);
            }
        }

        if (clearedRows.length > 0) {
            const count = clearedRows.length;
            this.lines += count;

            // スコア計算
            const linePoints = [0, 100, 300, 500, 800];
            const basePoints = linePoints[count] || count * 200;
            const gainedScore = basePoints * this.level;
            this.score += gainedScore;
            this.saveHighScore();

            // レベルアップ計算
            const oldLevel = this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            if (this.level > oldLevel) {
                this.updateDropInterval();
                this.emit('levelUp', { level: this.level });
            }

            // 消去コールバック（レンダラーでアニメーションさせるため盤面消去はアニメーション後に実行）
            this.emit('lineClear', {
                clearedRows,
                lineCount: count,
                isTetris: count === 4,
                scoreGained: gainedScore
            });
        } else {
            // 消去がなければ次をスポーン
            this.spawnPiece();
        }
    }

    /**
     * アニメーション完了後に実際の盤面行を削除・詰める
     */
    applyLineClears(clearedRows) {
        for (const rowIdx of clearedRows) {
            this.board.splice(rowIdx, 1);
            this.board.unshift(Array(BOARD_COLS).fill(null));
        }
        if (this.isPlaying && !this.isGameOver) {
            this.spawnPiece();
        }
    }

    // ==========================================
    // ゲームライフサイクル
    // ==========================================
    start() {
        this.board = this.createEmptyBoard();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.isGameOver = false;
        this.isPaused = false;
        this.isPlaying = true;
        this.holdPiece = null;
        this.canHold = true;
        this.updateDropInterval();

        this.initQueue();
        this.spawnPiece();
        this.lastDropTime = performance.now();

        this.emit('start');
    }

    pause() {
        if (!this.isPlaying || this.isGameOver) return;
        this.isPaused = !this.isPaused;
        this.clearLockDelay();
        this.emit('pause', { isPaused: this.isPaused });
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.isPlaying = false;
        this.clearLockDelay();
        this.saveHighScore();
        this.emit('gameOver', { score: this.score, highScore: this.highScore });
    }

    // ==========================================
    // メイン更新ループ
    // ==========================================
    update(time) {
        if (!this.isPlaying || this.isPaused || this.isGameOver || !this.currentPiece) return;

        if (time - this.lastDropTime > this.dropInterval) {
            this.moveDown();
            this.lastDropTime = time;
        }
    }

    emit(eventName, data = {}) {
        if (typeof this.onEvent === 'function') {
            this.onEvent(eventName, data);
        }
    }
}

window.TetrisGame = TetrisGame;
window.TETROMINOES = TETROMINOES;
window.BOARD_COLS = BOARD_COLS;
window.BOARD_ROWS = BOARD_ROWS;
