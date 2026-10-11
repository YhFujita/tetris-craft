/**
 * renderer.js - Canvas レンダラー
 * クラシック（ネオン・クリスタル）＆ 木目（立体彫刻・寄木細工）の2大スタイル描画
 * ライン消去の超爽快エフェクト（パーティクル、衝撃波、スクリーンシェイク、文字ポップ）
 */

class TetrisRenderer {
    constructor(mainCanvas, holdCanvas, nextCanvas) {
        this.canvas = mainCanvas;
        this.ctx = mainCanvas.getContext('2d');
        this.holdCanvas = holdCanvas;
        this.holdCtx = holdCanvas ? holdCanvas.getContext('2d') : null;
        this.nextCanvas = nextCanvas;
        this.nextCtx = nextCanvas ? nextCanvas.getContext('2d') : null;

        // テーマ: 'classic' または 'wood'
        this.style = 'classic';
        window.currentGameStyle = this.style;

        // パーティクル＆エフェクト管理
        this.particles = [];
        this.floatingTexts = [];
        this.lineClearAnimations = []; // { rows, startTime, duration }
        this.shakeTime = 0;
        this.shakeIntensity = 0;

        // 銘木の木目カラー定義
        this.woodPalettes = {
            hinoki: { base: '#d7bc8d', light: '#ebd7b2', dark: '#ad8d5f', ring: '#997648' },   // 檜（淡黄白木）
            indigo: { base: '#43617e', light: '#678ba9', dark: '#2b3f54', ring: '#202f3f' },   // 藍染木
            zelkova: { base: '#c66c35', light: '#e58e57', dark: '#9c4c1e', ring: '#7b360f' },  // 欅（ケヤキ・赤褐色）
            oak: { base: '#cda869', light: '#dfc28b', dark: '#9f7a3f', ring: '#825f29' },      // 楢（オーク・黄金木）
            bamboo: { base: '#819c5c', light: '#a2bd7c', dark: '#5b743a', ring: '#45592a' },   // 銘竹
            walnut: { base: '#6d4834', light: '#8c6046', dark: '#4c2e1e', ring: '#361d10' },   // ウォールナット（紫檀深木）
            cherry: { base: '#a8473a', light: '#ca6859', dark: '#7b2e23', ring: '#5e1e15' }    // 桜（赤木）
        };

        // 木目テクスチャパターンのキャッシュ
        this.woodPatternCache = new Map();

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    setStyle(style) {
        this.style = style;
        window.currentGameStyle = style;
    }

    /**
     * 高解像度ディスプレイ (Retina / HiDPI) に対応したリサイズ処理
     */
    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        if (rect.width > 0 && rect.height > 0) {
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        // ブロックサイズを盤面に合わせて算出
        this.blockSize = Math.floor(rect.width / BOARD_COLS);

        // サイドパネル (HOLD & NEXT)
        [this.holdCanvas, this.nextCanvas].forEach(canv => {
            if (canv) {
                const cRect = canv.getBoundingClientRect();
                if (cRect.width > 0 && cRect.height > 0) {
                    canv.width = cRect.width * dpr;
                    canv.height = cRect.height * dpr;
                    const cCtx = canv.getContext('2d');
                    cCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
            }
        });
    }

    // ==========================================
    // エフェクト発火メソッド
    // ==========================================

    /**
     * スクリーンシェイクのトリガー
     */
    triggerShake(intensity = 6, duration = 250) {
        this.shakeIntensity = intensity;
        this.shakeTime = performance.now() + duration;
    }

    /**
     * ライン消去演出開始
     */
    startLineClearEffect(rows, count, isTetris) {
        const now = performance.now();
        this.lineClearAnimations.push({
            rows: [...rows],
            startTime: now,
            duration: 320
        });

        // シェイク
        this.triggerShake(isTetris ? 12 : count * 2.5, isTetris ? 400 : 250);

        // パーティクル生成
        const rect = this.canvas.getBoundingClientRect();
        const blockW = rect.width / BOARD_COLS;
        const blockH = rect.height / BOARD_ROWS;

        rows.forEach(r => {
            const y = (r + 0.5) * blockH;
            const particleCount = isTetris ? 35 : 18;

            for (let i = 0; i < particleCount; i++) {
                const x = (Math.random() * BOARD_COLS) * blockW;
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * (isTetris ? 9 : 5);

                this.particles.push({
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 1.5,
                    size: 3 + Math.random() * (this.style === 'wood' ? 5 : 4),
                    color: this.getParticleColor(),
                    alpha: 1.0,
                    life: 1.0,
                    decay: 0.015 + Math.random() * 0.02,
                    isWoodChip: this.style === 'wood',
                    rotation: Math.random() * Math.PI,
                    rotSpeed: (Math.random() - 0.5) * 0.2
                });
            }
        });

        // 浮遊ポップアップテキスト
        const textMap = {
            1: 'SINGLE!',
            2: 'DOUBLE!!',
            3: 'TRIPLE!!!',
            4: '★ TETRIS ★'
        };
        const text = textMap[count] || `${count} LINES!`;
        const avgRow = rows.reduce((a, b) => a + b, 0) / rows.length;

        this.floatingTexts.push({
            text,
            x: rect.width / 2,
            y: (avgRow + 0.5) * blockH,
            scale: 0.5,
            targetScale: isTetris ? 1.6 : 1.2,
            alpha: 1.0,
            startTime: now,
            duration: 900,
            isTetris
        });
    }

    getParticleColor() {
        if (this.style === 'wood') {
            // 木屑・金粉（金継ぎの輝き）
            const colors = ['#f5d061', '#ffd700', '#d4a373', '#e09f3e', '#faedcd', '#bc6c25'];
            return colors[Math.floor(Math.random() * colors.length)];
        } else {
            // ネオンスパーク
            const colors = ['#00f0ff', '#ff007f', '#ffe600', '#00ff66', '#a855f7', '#ffffff'];
            return colors[Math.floor(Math.random() * colors.length)];
        }
    }

    // ==========================================
    // メイン描画ループ
    // ==========================================
    render(game, timestamp) {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const blockW = width / BOARD_COLS;
        const blockH = height / BOARD_ROWS;

        this.ctx.save();

        // 画面振動（スクリーンシェイク）の適用
        if (timestamp < this.shakeTime) {
            const decay = (this.shakeTime - timestamp) / 300;
            const currentIntensity = this.shakeIntensity * Math.max(0, decay);
            const ox = (Math.random() - 0.5) * currentIntensity * 2;
            const oy = (Math.random() - 0.5) * currentIntensity * 2;
            this.ctx.translate(ox, oy);
        }

        // 背景描画
        this.drawBoardBackground(width, height);

        // 盤面に配置された固定ブロック描画
        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                const cell = game.board[r][c];
                if (cell) {
                    this.drawBlock(c * blockW, r * blockH, blockW, blockH, cell, 1.0);
                }
            }
        }

        // ゴーストブロック（落下予測地点）
        if (game.currentPiece && game.isPlaying && !game.isPaused) {
            const ghostY = game.ghostY;
            if (ghostY !== game.currentPiece.y) {
                this.drawPiece(game.currentPiece, game.currentPiece.x, ghostY, blockW, blockH, true);
            }
        }

        // 現在操作中のブロック
        if (game.currentPiece && game.isPlaying && !game.isPaused) {
            this.drawPiece(game.currentPiece, game.currentPiece.x, game.currentPiece.y, blockW, blockH, false);
        }

        // ライン消去中のフラッシュ演出描画
        this.drawLineClearAnimations(timestamp, width, blockH);

        // パーティクル描画と更新
        this.renderParticles();

        // ポップアップテキスト描画
        this.renderFloatingTexts(timestamp);

        this.ctx.restore();

        // サイドパネル (HOLD & NEXT) 描画
        this.renderHold(game.holdPiece, game.canHold);
        this.renderNext(game.nextQueue);
    }

    // ==========================================
    // 背景・グリッド描画
    // ==========================================
    drawBoardBackground(width, height) {
        this.ctx.clearRect(0, 0, width, height);

        if (this.style === 'wood') {
            // 木目スタイル: 高級木製トレイ（深みのあるウォールナットのベースと面取り溝）
            const grad = this.ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, '#2d1f16');
            grad.addColorStop(0.5, '#231710');
            grad.addColorStop(1, '#1b120c');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, width, height);

            // 彫り込まれたグリッド線 (内シャドウ溝)
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.lineWidth = 1;
            const blockW = width / BOARD_COLS;
            const blockH = height / BOARD_ROWS;

            this.ctx.beginPath();
            for (let c = 1; c < BOARD_COLS; c++) {
                this.ctx.moveTo(c * blockW, 0);
                this.ctx.lineTo(c * blockW, height);
            }
            for (let r = 1; r < BOARD_ROWS; r++) {
                this.ctx.moveTo(0, r * blockH);
                this.ctx.lineTo(width, r * blockH);
            }
            this.ctx.stroke();

            // 木枠の境界シャドウ
            this.ctx.strokeStyle = 'rgba(255, 215, 170, 0.08)';
            this.ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

        } else {
            // クラシックスタイル: サイバーパンク・ディープネオン
            const grad = this.ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#090b14');
            grad.addColorStop(1, '#0f1422');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, width, height);

            // 繊細なネオングリッド
            this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
            this.ctx.lineWidth = 1;
            const blockW = width / BOARD_COLS;
            const blockH = height / BOARD_ROWS;

            this.ctx.beginPath();
            for (let c = 1; c < BOARD_COLS; c++) {
                this.ctx.moveTo(c * blockW, 0);
                this.ctx.lineTo(c * blockW, height);
            }
            for (let r = 1; r < BOARD_ROWS; r++) {
                this.ctx.moveTo(0, r * blockH);
                this.ctx.lineTo(width, r * blockH);
            }
            this.ctx.stroke();
        }
    }

    // ==========================================
    // ブロック単体の描画 (クラシック vs 立体木目)
    // ==========================================
    drawBlock(x, y, w, h, blockData, alpha = 1.0, isGhost = false) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha;

        const pad = 1.5;
        const bx = x + pad;
        const by = y + pad;
        const bw = w - pad * 2;
        const bh = h - pad * 2;

        if (this.style === 'wood') {
            this.drawWoodBlock(bx, by, bw, bh, blockData, isGhost);
        } else {
            this.drawClassicBlock(bx, by, bw, bh, blockData, isGhost);
        }

        this.ctx.restore();
    }

    /**
     * 木目スタイル: 立体的な面取り木工彫刻ブロック
     */
    drawWoodBlock(x, y, w, h, blockData, isGhost) {
        const type = blockData.woodWoodType || 'oak';
        const pal = this.woodPalettes[type] || this.woodPalettes.oak;

        if (isGhost) {
            // ゴースト時は細い木枠ラインのみ
            this.ctx.strokeStyle = pal.light;
            this.ctx.lineWidth = 1.5;
            this.ctx.setLineDash([3, 3]);
            this.ctx.strokeRect(x, y, w, h);
            this.ctx.setLineDash([]);
            return;
        }

        const bevel = Math.max(3, Math.floor(w * 0.16)); // 立体面取り幅
        const radius = 3;

        // 1. 全体ベースシャドウ（落下時の立体感）
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        this.ctx.shadowBlur = 4;
        this.ctx.shadowOffsetY = 2;

        // 2. メイン木材ベース
        this.ctx.fillStyle = pal.base;
        this.ctx.beginPath();
        this.ctx.roundRect ? this.ctx.roundRect(x, y, w, h, radius) : this.ctx.rect(x, y, w, h);
        this.ctx.fill();

        this.ctx.shadowColor = 'transparent'; // シャドウ解除

        // 3. プロシージャル年輪・木目テクスチャの描画
        this.drawWoodGrain(x, y, w, h, pal);

        // 4. 立体面取りベベル (上面・左面は明るいハイライト、下面・右面は深い影)
        // 上面ベベル (光が当たる)
        this.ctx.fillStyle = pal.light;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + w, y);
        this.ctx.lineTo(x + w - bevel, y + bevel);
        this.ctx.lineTo(x + bevel, y + bevel);
        this.ctx.closePath();
        this.ctx.fill();

        // 左面ベベル (光が当たる)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + bevel, y + bevel);
        this.ctx.lineTo(x + bevel, y + h - bevel);
        this.ctx.lineTo(x, y + h);
        this.ctx.closePath();
        this.ctx.fill();

        // 下面ベベル (影)
        this.ctx.fillStyle = pal.dark;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + h);
        this.ctx.lineTo(x + bevel, y + h - bevel);
        this.ctx.lineTo(x + w - bevel, y + h - bevel);
        this.ctx.lineTo(x + w, y + h);
        this.ctx.closePath();
        this.ctx.fill();

        // 右面ベベル (影)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        this.ctx.beginPath();
        this.ctx.moveTo(x + w, y);
        this.ctx.lineTo(x + w, y + h);
        this.ctx.lineTo(x + w - bevel, y + h - bevel);
        this.ctx.lineTo(x + w - bevel, y + bevel);
        this.ctx.closePath();
        this.ctx.fill();

        // 5. 内側エッジの繊細な彫刻ライン
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.lineWidth = 0.8;
        this.ctx.strokeRect(x + bevel, y + bevel, w - bevel * 2, h - bevel * 2);

        // 6. 木工製品のような上部ハイライト光
        const topGlint = this.ctx.createLinearGradient(x, y, x + w, y + h);
        topGlint.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        topGlint.addColorStop(0.3, 'rgba(255, 255, 255, 0.0)');
        this.ctx.fillStyle = topGlint;
        this.ctx.fillRect(x + bevel, y + bevel, w - bevel * 2, h - bevel * 2);
    }

    /**
     * 木材の年輪・繊維パターン描画
     */
    drawWoodGrain(x, y, w, h, pal) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(x, y, w, h);
        this.ctx.clip();

        this.ctx.strokeStyle = pal.ring;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.22;

        // 斜めに走る微細な木目ライン
        const lineSpacing = 4.5;
        for (let i = -w; i < w + h; i += lineSpacing) {
            this.ctx.beginPath();
            // わずかな波打ちカーブで天然木感を演出
            this.ctx.moveTo(x + i, y);
            this.ctx.quadraticCurveTo(
                x + i + 8,
                y + h * 0.5,
                x + i + (i % 2 === 0 ? 3 : -3),
                y + h
            );
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    /**
     * クラシックスタイル: ネオン・クリスタルガラス風ブロック
     */
    drawClassicBlock(x, y, w, h, blockData, isGhost) {
        const color = blockData.classicColor || '#00f0ff';

        if (isGhost) {
            // ゴーストブロック（洗練された細いネオン枠）
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1.5;
            this.ctx.globalAlpha = 0.35;
            this.ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
            return;
        }

        const radius = 3.5;

        // グロー効果
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 8;

        // メイングラデーション
        const grad = this.ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, this.lightenColor(color, 35));
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, this.darkenColor(color, 25));

        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.roundRect ? this.ctx.roundRect(x, y, w, h, radius) : this.ctx.rect(x, y, w, h);
        this.ctx.fill();

        this.ctx.shadowColor = 'transparent';

        // ガラスのようなトップ光沢ハイライト
        const shine = this.ctx.createLinearGradient(x, y, x, y + h * 0.5);
        shine.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        shine.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        this.ctx.fillStyle = shine;
        this.ctx.fillRect(x + 1.5, y + 1.5, w - 3, h * 0.45);

        // 外枠ネオンエッジ
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect ? this.ctx.roundRect(x, y, w, h, radius) : this.ctx.rect(x, y, w, h);
        this.ctx.stroke();
    }

    // ==========================================
    // ピース（テトリミノ）全体の描画
    // ==========================================
    drawPiece(piece, startX, startY, blockW, blockH, isGhost = false) {
        const { shape } = piece;
        const alpha = isGhost ? 0.35 : 1.0;

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const bx = (startX + c) * blockW;
                    const by = (startY + r) * blockH;
                    if (by >= -blockH) {
                        this.drawBlock(bx, by, blockW, blockH, piece, alpha, isGhost);
                    }
                }
            }
        }
    }

    // ==========================================
    // ライン消去アニメーション (白熱フラッシュ)
    // ==========================================
    drawLineClearAnimations(timestamp, width, blockH) {
        this.lineClearAnimations = this.lineClearAnimations.filter(anim => {
            const elapsed = timestamp - anim.startTime;
            if (elapsed > anim.duration) return false;

            const progress = elapsed / anim.duration;
            // 閃光の強さ（前半に急激にピーク、後半に収束）
            const flashAlpha = Math.sin(progress * Math.PI) * 0.95;

            anim.rows.forEach(r => {
                const y = r * blockH;

                if (this.style === 'wood') {
                    // 木目スタイル: 金継ぎの眩いゴールドフラッシュ
                    const grad = this.ctx.createLinearGradient(0, y, width, y);
                    grad.addColorStop(0, `rgba(255, 215, 0, ${flashAlpha * 0.3})`);
                    grad.addColorStop(0.5, `rgba(255, 250, 220, ${flashAlpha * 1.0})`);
                    grad.addColorStop(1, `rgba(255, 215, 0, ${flashAlpha * 0.3})`);
                    this.ctx.fillStyle = grad;
                    this.ctx.fillRect(0, y, width, blockH);

                    // 水平の光のビーム
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${flashAlpha})`;
                    this.ctx.lineWidth = 3;
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, y + blockH / 2);
                    this.ctx.lineTo(width, y + blockH / 2);
                    this.ctx.stroke();
                } else {
                    // クラシック: レーザーホワイトフラッシュ
                    const grad = this.ctx.createLinearGradient(0, y, width, y);
                    grad.addColorStop(0, `rgba(0, 240, 255, ${flashAlpha * 0.5})`);
                    grad.addColorStop(0.5, `rgba(255, 255, 255, ${flashAlpha * 1.0})`);
                    grad.addColorStop(1, `rgba(0, 240, 255, ${flashAlpha * 0.5})`);
                    this.ctx.fillStyle = grad;
                    this.ctx.fillRect(0, y, width, blockH);

                    // ネオングロービーム
                    this.ctx.shadowColor = '#00f0ff';
                    this.ctx.shadowBlur = 15;
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${flashAlpha})`;
                    this.ctx.lineWidth = 2.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, y + blockH / 2);
                    this.ctx.lineTo(width, y + blockH / 2);
                    this.ctx.stroke();
                    this.ctx.shadowColor = 'transparent';
                }
            });

            return true;
        });
    }

    // ==========================================
    // パーティクルシステム
    // ==========================================
    renderParticles() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.18; // 重力
            p.alpha -= p.decay;
            if (p.isWoodChip) {
                p.rotation += p.rotSpeed;
            }

            if (p.alpha <= 0) return false;

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, p.alpha);
            this.ctx.translate(p.x, p.y);

            if (p.isWoodChip) {
                // 木片の回転描画（長方形ウッドチップ）
                this.ctx.rotate(p.rotation);
                this.ctx.fillStyle = p.color;
                this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                // ネオンスパーク（星型・円形）
                this.ctx.fillStyle = p.color;
                this.ctx.shadowColor = p.color;
                this.ctx.shadowBlur = 6;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
            return true;
        });
    }

    // ==========================================
    // フローティングテキスト
    // ==========================================
    renderFloatingTexts(timestamp) {
        this.floatingTexts = this.floatingTexts.filter(ft => {
            const elapsed = timestamp - ft.startTime;
            if (elapsed > ft.duration) return false;

            const progress = elapsed / ft.duration;
            // イージング（バウンススケール）
            const scale = ft.scale + (ft.targetScale - ft.scale) * Math.min(1, progress * 4);
            const alpha = 1.0 - Math.pow(progress, 2);
            const y = ft.y - progress * 40;

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, alpha);
            this.ctx.translate(ft.x, y);
            this.ctx.scale(scale, scale);

            this.ctx.font = `bold ${ft.isTetris ? '24px' : '18px'} 'Segoe UI', 'Hiragino Sans', sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            if (this.style === 'wood') {
                this.ctx.fillStyle = ft.isTetris ? '#ffe600' : '#faedcd';
                this.ctx.shadowColor = '#000000';
                this.ctx.shadowBlur = 6;
                this.ctx.fillText(ft.text, 0, 0);
            } else {
                this.ctx.fillStyle = ft.isTetris ? '#00f0ff' : '#ffffff';
                this.ctx.shadowColor = ft.isTetris ? '#00f0ff' : '#ff007f';
                this.ctx.shadowBlur = 10;
                this.ctx.fillText(ft.text, 0, 0);
            }

            this.ctx.restore();
            return true;
        });
    }

    // ==========================================
    // HOLD & NEXT サブパネル描画
    // ==========================================
    renderHold(holdPieceType, canHold) {
        if (!this.holdCtx || !this.holdCanvas) return;
        const ctx = this.holdCtx;
        const rect = this.holdCanvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);

        if (!holdPieceType) return;
        const piece = TETROMINOES[holdPieceType];
        if (!piece) return;

        this.drawCenteredPiece(ctx, rect.width, rect.height, piece, canHold ? 1.0 : 0.4);
    }

    renderNext(nextQueue) {
        if (!this.nextCtx || !this.nextCanvas) return;
        const ctx = this.nextCtx;
        const rect = this.nextCanvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);

        if (!nextQueue || nextQueue.length === 0) return;

        // 最大3個まで表示
        const count = Math.min(3, nextQueue.length);
        const slotH = rect.height / count;

        for (let i = 0; i < count; i++) {
            const pieceType = nextQueue[i];
            const piece = TETROMINOES[pieceType];
            if (piece) {
                ctx.save();
                ctx.translate(0, i * slotH);
                this.drawCenteredPiece(ctx, rect.width, slotH, piece, i === 0 ? 1.0 : 0.65);
                ctx.restore();
            }
        }
    }

    drawCenteredPiece(ctx, width, height, piece, alpha = 1.0) {
        const shape = piece.shape;
        const rows = shape.length;
        const cols = shape[0].length;

        // 空白行・列を除いた実質サイズ
        let minR = rows, maxR = -1, minC = cols, maxC = -1;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (shape[r][c]) {
                    if (r < minR) minR = r;
                    if (r > maxR) maxR = r;
                    if (c < minC) minC = c;
                    if (c > maxC) maxC = c;
                }
            }
        }

        const actualW = maxC - minC + 1;
        const actualH = maxR - minR + 1;
        const blockSize = Math.min(Math.floor((width * 0.7) / actualW), Math.floor((height * 0.7) / actualH), 22);

        const totalW = actualW * blockSize;
        const totalH = actualH * blockSize;
        const startX = (width - totalW) / 2 - minC * blockSize;
        const startY = (height - totalH) / 2 - minR * blockSize;

        ctx.save();
        ctx.globalAlpha = alpha;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (shape[r][c]) {
                    const bx = startX + c * blockSize;
                    const by = startY + r * blockSize;

                    if (this.style === 'wood') {
                        const pal = this.woodPalettes[piece.woodWoodType] || this.woodPalettes.oak;
                        ctx.fillStyle = pal.base;
                        ctx.fillRect(bx + 1, by + 1, blockSize - 2, blockSize - 2);
                        ctx.strokeStyle = pal.light;
                        ctx.strokeRect(bx + 1, by + 1, blockSize - 2, blockSize - 2);
                    } else {
                        ctx.fillStyle = piece.classicColor;
                        ctx.fillRect(bx + 1, by + 1, blockSize - 2, blockSize - 2);
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                        ctx.strokeRect(bx + 1, by + 1, blockSize - 2, blockSize - 2);
                    }
                }
            }
        }

        ctx.restore();
    }

    // ==========================================
    // 色ユーティリティ
    // ==========================================
    lightenColor(hex, percent) {
        return this.adjustColor(hex, percent);
    }

    darkenColor(hex, percent) {
        return this.adjustColor(hex, -percent);
    }

    adjustColor(hex, percent) {
        let num = parseInt(hex.replace('#', ''), 16);
        let amt = Math.round(2.55 * percent);
        let R = (num >> 16) + amt;
        let G = (num >> 8 & 0x00FF) + amt;
        let B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 +
            (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 0 ? 0 : B) : 255)
        ).toString(16).slice(1);
    }
}

window.TetrisRenderer = TetrisRenderer;
