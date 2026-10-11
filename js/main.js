/**
 * main.js - ゲーム全体の初期化とメインループ、UIイベントの制御
 */

document.addEventListener('DOMContentLoaded', () => {
    // Canvas要素
    const mainCanvas = document.getElementById('board-canvas');
    const holdCanvas = document.getElementById('hold-canvas');
    const nextCanvas = document.getElementById('next-canvas');

    // UI要素
    const scoreVal = document.getElementById('score-val');
    const highScoreVal = document.getElementById('high-score-val');
    const levelVal = document.getElementById('level-val');
    const linesVal = document.getElementById('lines-val');

    const themeSelect = document.getElementById('theme-select');
    const modeSelect = document.getElementById('mode-select');

    // MIDI UI要素
    const bgmSelect = document.getElementById('bgm-select');
    const btnBgmToggle = document.getElementById('btn-bgm-toggle');
    const midiFileInput = document.getElementById('midi-file-input');
    const bgmVolumeSlider = document.getElementById('bgm-volume');
    const seVolumeSlider = document.getElementById('se-volume');
    const midiStatusText = document.getElementById('midi-status');

    // モーダル
    const startModal = document.getElementById('start-modal');
    const gameOverModal = document.getElementById('game-over-modal');
    const pauseModal = document.getElementById('pause-modal');
    const btnStart = document.getElementById('btn-start');
    const btnRestart = document.getElementById('btn-restart');
    const btnResume = document.getElementById('btn-resume');
    const finalScoreVal = document.getElementById('final-score-val');
    const finalHighScoreVal = document.getElementById('final-high-score-val');

    // インスタンス生成
    const game = new TetrisGame();
    const renderer = new TetrisRenderer(mainCanvas, holdCanvas, nextCanvas);
    const sound = window.soundController;
    const input = new InputManager(game, mainCanvas, sound);

    // ハイスコア初期表示
    highScoreVal.textContent = game.highScore.toLocaleString();

    // ==========================================
    // ゲームイベントとサウンド・演出の連携
    // ==========================================
    game.onEvent = (eventName, data) => {
        switch (eventName) {
            case 'move':
                sound.playMove();
                break;

            case 'rotate':
                sound.playRotate();
                break;

            case 'lock':
                sound.playDrop();
                break;

            case 'hardDrop':
                sound.playHardDrop();
                break;

            case 'hold':
                sound.playHold();
                break;

            case 'lineClear':
                sound.playLineClear(data.lineCount);
                renderer.startLineClearEffect(data.clearedRows, data.lineCount, data.isTetris);
                // アニメーション後に盤面を詰める
                setTimeout(() => {
                    game.applyLineClears(data.clearedRows);
                }, 260);
                break;

            case 'gameOver':
                sound.playGameOver();
                finalScoreVal.textContent = data.score.toLocaleString();
                finalHighScoreVal.textContent = data.highScore.toLocaleString();
                highScoreVal.textContent = data.highScore.toLocaleString();
                gameOverModal.classList.remove('hidden');
                break;

            case 'pause':
                if (data.isPaused) {
                    pauseModal.classList.remove('hidden');
                    sound.pauseBgm();
                } else {
                    pauseModal.classList.add('hidden');
                    if (btnBgmToggle.getAttribute('data-playing') === 'true') {
                        sound.startBgm();
                    }
                }
                break;
        }

        // スコアUIの常時同期
        scoreVal.textContent = game.score.toLocaleString();
        levelVal.textContent = game.level.toString();
        linesVal.textContent = game.lines.toString();
        highScoreVal.textContent = game.highScore.toLocaleString();
    };

    // ==========================================
    // デザインスタイル (テーマ) 切り替え
    // ==========================================
    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        renderer.setStyle(theme);

        // テーマに応じた推奨BGM自動提案（ユーザーがカスタム再生中でなければ）
        if (sound.currentPreset !== 'custom') {
            const recommendedBgm = theme === 'wood' ? 'woodland' : 'korobeiniki';
            if (bgmSelect.value !== recommendedBgm) {
                bgmSelect.value = recommendedBgm;
                sound.loadPresetBgm(recommendedBgm);
                if (sound.isPlayingMidi) {
                    sound.startBgm();
                }
            }
        }
    }

    themeSelect.addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });

    // ==========================================
    // ゲームモード切り替え
    // ==========================================
    modeSelect.addEventListener('change', (e) => {
        game.setMode(e.target.value);
    });

    // ==========================================
    // MIDI BGM コントロール
    // ==========================================
    bgmSelect.addEventListener('change', (e) => {
        sound.init();
        const choice = e.target.value;
        if (choice === 'korobeiniki' || choice === 'woodland') {
            sound.loadPresetBgm(choice);
            midiStatusText.textContent = `再生中: ${choice === 'korobeiniki' ? 'コロブチカ' : '木漏れ日'}`;
            if (btnBgmToggle.getAttribute('data-playing') === 'true') {
                sound.startBgm();
            }
        }
    });

    btnBgmToggle.addEventListener('click', () => {
        sound.init();
        const isPlaying = sound.isPlayingMidi;
        if (isPlaying) {
            sound.pauseBgm();
            btnBgmToggle.textContent = '▶ BGM 再生';
            btnBgmToggle.setAttribute('data-playing', 'false');
        } else {
            sound.startBgm();
            btnBgmToggle.textContent = '⏸ BGM 停止';
            btnBgmToggle.setAttribute('data-playing', 'true');
        }
    });

    bgmVolumeSlider.addEventListener('input', (e) => {
        sound.setBgmVolume(parseFloat(e.target.value));
    });

    seVolumeSlider.addEventListener('input', (e) => {
        sound.setSeVolume(parseFloat(e.target.value));
    });

    // 外部 MIDI ファイルの読み込み処理
    async function handleMidiFile(file) {
        if (!file) return;
        sound.init();
        midiStatusText.textContent = `解析中: ${file.name}...`;

        try {
            const info = await sound.loadMidiFile(file);
            midiStatusText.textContent = `♪ ${file.name} (${info.noteCount}音)`;

            // セレクトボックスにカスタム表示
            let customOption = bgmSelect.querySelector('option[value="custom"]');
            if (!customOption) {
                customOption = document.createElement('option');
                customOption.value = 'custom';
                bgmSelect.appendChild(customOption);
            }
            customOption.textContent = `外部: ${file.name}`;
            bgmSelect.value = 'custom';

            btnBgmToggle.textContent = '⏸ BGM 停止';
            btnBgmToggle.setAttribute('data-playing', 'true');
        } catch (err) {
            alert(`MIDIファイルの読み込みに失敗しました: ${err.message}`);
            midiStatusText.textContent = '読み込み失敗';
        }
    }

    midiFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleMidiFile(file);
    });

    // ドラッグ＆ドロップでMIDIファイルを読み込み可能にする
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.name.toLowerCase().endsWith('.mid') || file.name.toLowerCase().endsWith('.midi')) {
                handleMidiFile(file);
            }
        }
    });

    // ==========================================
    // スタート・リスタート・再開
    // ==========================================
    function startGame() {
        sound.init();
        startModal.classList.add('hidden');
        gameOverModal.classList.add('hidden');
        pauseModal.classList.add('hidden');

        game.setMode(modeSelect.value);
        applyTheme(themeSelect.value);
        game.start();

        // BGM自動開始
        if (btnBgmToggle.getAttribute('data-playing') === 'true') {
            sound.startBgm();
        }
    }

    btnStart.addEventListener('click', startGame);
    btnRestart.addEventListener('click', startGame);
    btnResume.addEventListener('click', () => {
        game.pause();
    });

    // ==========================================
    // メインループ (requestAnimationFrame)
    // ==========================================
    function mainLoop(timestamp) {
        game.update(timestamp);
        renderer.render(game, timestamp);
        requestAnimationFrame(mainLoop);
    }

    requestAnimationFrame(mainLoop);
});
