/**
 * audio.js - Web Audio API によるシンセ音源・効果音・MIDIパーサー＆プレイヤー
 */

class SoundController {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.bgmGain = null;
        this.seGain = null;
        this.isMuted = false;
        this.bgmVolume = 0.4;
        this.seVolume = 0.5;

        // MIDI プレイヤー状態
        this.currentTrackNotes = []; // { time, note, duration, velocity, channel }
        this.totalDuration = 0;
        this.isPlayingMidi = false;
        this.midiStartTime = 0;
        this.midiPauseOffset = 0;
        this.activeMidiNodes = [];
        this.midiLoop = true;
        this.scheduledIndex = 0;
        this.playbackTimer = null;

        // プリセットBGMリスト
        this.currentPreset = 'medley';
        this.compressor = null;

        this.initialized = false;
    }

    /**
     * ユーザー操作時に AudioContext を初期化
     */
    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // マスターコンプレッサー（音割れ防止 & 音圧と厚みの向上）
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(10, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
        this.bgmGain.connect(this.masterGain);

        this.seGain = this.ctx.createGain();
        this.seGain.gain.setValueAtTime(this.seVolume, this.ctx.currentTime);
        this.seGain.connect(this.masterGain);

        this.initialized = true;

        // プリセットの読み込み
        this.loadPresetBgm(this.currentPreset);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setBgmVolume(val) {
        this.bgmVolume = Math.max(0, Math.min(1, val));
        if (this.bgmGain && this.ctx) {
            this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
        }
    }

    setSeVolume(val) {
        this.seVolume = Math.max(0, Math.min(1, val));
        if (this.seGain && this.ctx) {
            this.seGain.gain.setValueAtTime(this.seVolume, this.ctx.currentTime);
        }
    }

    // ==========================================
    // 効果音 (SE) 生成
    // ==========================================

    /** 移動音 */
    playMove() {
        if (!this.initialized || this.seVolume === 0) return;
        this.resume();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.04);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        osc.connect(gain);
        gain.connect(this.seGain);

        osc.start(t);
        osc.stop(t + 0.05);
    }

    /** 回転音 */
    playRotate() {
        if (!this.initialized || this.seVolume === 0) return;
        this.resume();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.07);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(this.seGain);

        osc.start(t);
        osc.stop(t + 0.08);
    }

    /** 着地/ロック音 */
    playDrop() {
        if (!this.initialized || this.seVolume === 0) return;
        this.resume();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc.connect(gain);
        gain.connect(this.seGain);

        osc.start(t);
        osc.stop(t + 0.09);
    }

    /** ハードドロップ音 */
    playHardDrop() {
        if (!this.initialized || this.seVolume === 0) return;
        this.resume();
        const t = this.ctx.currentTime;

        // 打撃音用低音オシレーター
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

        osc.connect(gain);
        gain.connect(this.seGain);
        osc.start(t);
        osc.stop(t + 0.13);
    }

    /** ホールド音 */
    playHold() {
        if (!this.initialized || this.seVolume === 0) return;
        this.resume();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, t);
        osc.frequency.linearRampToValueAtTime(520, t + 0.05);
        osc.frequency.linearRampToValueAtTime(700, t + 0.1);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

        osc.connect(gain);
        gain.connect(this.seGain);

        osc.start(t);
        osc.stop(t + 0.11);
    }

    /** ライン消去音 (消去ライン数に応じて和音・華やかさを変える) */
    playLineClear(lines = 1) {
        if (!this.initialized || this.seVolume === 0) return;
        this.resume();
        const t = this.ctx.currentTime;

        // ノートの構成（1行: C5,E5 / 2行: C5,E5,G5 / 3行: C5,E5,G5,C6 / 4行: テトリスファンファーレ）
        const chords = {
            1: [523.25, 659.25],
            2: [523.25, 659.25, 783.99],
            3: [523.25, 659.25, 783.99, 1046.50],
            4: [523.25, 659.25, 783.99, 1046.50, 1318.51]
        };

        const freqs = chords[lines] || chords[1];
        const duration = lines === 4 ? 0.45 : 0.25;

        freqs.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = lines === 4 ? 'sawtooth' : 'sine';
            osc.frequency.setValueAtTime(freq, t + i * 0.03);

            const startT = t + i * 0.03;
            gain.gain.setValueAtTime(0.15, startT);
            gain.gain.exponentialRampToValueAtTime(0.001, startT + duration);

            osc.connect(gain);
            gain.connect(this.seGain);

            osc.start(startT);
            osc.stop(startT + duration);
        });

        // 4ライン消去 (TETRIS) 時のシンバル的ノイズエフェクト
        if (lines === 4) {
            this.playCymbalEffect();
        }
    }

    playCymbalEffect() {
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.seGain);

        noise.start(t);
        noise.stop(t + 0.3);
    }

    /** ゲームオーバー音 */
    playGameOver() {
        if (!this.initialized || this.seVolume === 0) return;
        this.resume();
        const t = this.ctx.currentTime;
        const notes = [440, 415, 392, 370, 330, 277, 220];

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t + idx * 0.12);

            const startT = t + idx * 0.12;
            gain.gain.setValueAtTime(0.2, startT);
            gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.2);

            osc.connect(gain);
            gain.connect(this.seGain);

            osc.start(startT);
            osc.stop(startT + 0.2);
        });
    }

    // ==========================================
    // MIDI 音色シンセサイザー＆再生機構
    // ==========================================

    /**
     * MIDIノート番号を周波数に変換
     */
    midiNoteToFreq(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    /**
     * 単一MIDIノートの発音
     */
    playSynthNote(time, note, duration, velocity, channel = 0, style = 'classic') {
        if (!this.ctx || this.isMuted) return;

        const freq = this.midiNoteToFreq(note);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        const vel = Math.max(0.1, Math.min(1.0, (velocity || 64) / 127));

        if (style === 'wood') {
            // 木目調スタイル: カリンバ・木琴・マリンバのような温かみのあるアコースティック音
            if (channel === 1) {
                // ベース: ウッドベース風の低域
                osc.type = 'triangle';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(Math.min(900, freq * 3), time);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(vel * 0.35, time + 0.01);
                gain.gain.exponentialRampToValueAtTime(vel * 0.15, time + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(duration, 0.6));
            } else if (channel === 2) {
                // コード・アルペジオ伴奏: 軽やかなポクポクした木琴音
                osc.type = 'sine';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(freq * 2.5, time);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(vel * 0.22, time + 0.008);
                gain.gain.exponentialRampToValueAtTime(vel * 0.08, time + 0.06);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(duration, 0.35));
            } else if (channel === 9) {
                // ドラム / ウッドブロック風リズム
                osc.type = 'sine';
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1200, time);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(vel * 0.25, time + 0.003);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
            } else {
                // メロディ & ハーモニー
                osc.type = 'sine';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(freq * 3, time);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(vel * 0.32, time + 0.008);
                gain.gain.exponentialRampToValueAtTime(vel * 0.1, time + 0.08);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(duration, 0.45));
            }
        } else {
            // クラシックスタイル: レトロな8-bit/FMシンセ風（パルス波/矩形波/重低音）
            if (channel === 1) {
                // ベース: 太い三角波とフィルターでしっかりボトムを支える
                osc.type = 'triangle';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(900, time);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(vel * 0.3, time + 0.01);
                gain.gain.exponentialRampToValueAtTime(vel * 0.2, time + 0.06);
                gain.gain.setValueAtTime(vel * 0.2, time + Math.max(0.05, duration - 0.03));
                gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            } else if (channel === 2) {
                // 和音・アルペジオ伴奏: 歯切れよくかつ滑らかに響く矩形波伴奏
                osc.type = 'square';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2400, time);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(vel * 0.15, time + 0.008);
                gain.gain.exponentialRampToValueAtTime(vel * 0.09, time + 0.05);
                gain.gain.setValueAtTime(vel * 0.09, time + Math.max(0.04, duration - 0.03));
                gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            } else if (channel === 3) {
                // ハーモニー/対旋律: 豊かな倍音を持つノコギリ波
                osc.type = 'sawtooth';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(3200, time);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(vel * 0.16, time + 0.01);
                gain.gain.exponentialRampToValueAtTime(vel * 0.1, time + 0.05);
                gain.gain.setValueAtTime(vel * 0.1, time + Math.max(0.05, duration - 0.04));
                gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            } else if (channel === 9) {
                // パーカッション / ハイハット: 高域三角波クリックによる歯切れ良いレトロリズム
                osc.type = 'triangle';
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(3200, time);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(vel * 0.16, time + 0.003);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
            } else {
                // チャンネル0: メインリードメロディ（クリアな矩形波）
                osc.type = 'square';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(3600, time);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(vel * 0.22, time + 0.01);
                gain.gain.exponentialRampToValueAtTime(vel * 0.14, time + 0.05);
                gain.gain.setValueAtTime(vel * 0.14, time + Math.max(0.05, duration - 0.04));
                gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            }
        }

        osc.frequency.setValueAtTime(freq, time);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.bgmGain);

        osc.start(time);
        osc.stop(time + duration);

        this.activeMidiNodes.push({ osc, gain });

        // ガベージコレクション用に終了後削除
        setTimeout(() => {
            const idx = this.activeMidiNodes.findIndex(n => n.osc === osc);
            if (idx !== -1) this.activeMidiNodes.splice(idx, 1);
        }, (duration + (time - this.ctx.currentTime) + 0.1) * 1000);
    }

    /**
     * BGM 再生開始
     */
    startBgm() {
        this.init();
        this.resume();
        if (this.isPlayingMidi) return;

        this.isPlayingMidi = true;
        this.midiStartTime = this.ctx.currentTime - this.midiPauseOffset;
        this.scheduleNotes();
    }

    /**
     * BGM 一時停止
     */
    pauseBgm() {
        if (!this.isPlayingMidi) return;
        this.isPlayingMidi = false;
        if (this.playbackTimer) {
            clearTimeout(this.playbackTimer);
            this.playbackTimer = null;
        }
        if (this.ctx) {
            this.midiPauseOffset = (this.ctx.currentTime - this.midiStartTime) % (this.totalDuration || 1);
        }
        this.stopActiveMidiNodes();
    }

    /**
     * BGM 停止
     */
    stopBgm() {
        this.pauseBgm();
        this.midiPauseOffset = 0;
        this.scheduledIndex = 0;
    }

    stopActiveMidiNodes() {
        this.activeMidiNodes.forEach(n => {
            try {
                n.osc.stop();
                n.osc.disconnect();
            } catch (e) {}
        });
        this.activeMidiNodes = [];
    }

    /**
     * スケジューリングループ（先読みスケジュール）
     */
    scheduleNotes(style = 'classic') {
        if (!this.isPlayingMidi || !this.ctx || this.currentTrackNotes.length === 0) return;

        const lookahead = 0.25; // 250ms 先までスケジュール
        const now = this.ctx.currentTime;
        const currentMidiTime = (now - this.midiStartTime);

        // ループ判定
        if (this.totalDuration > 0 && currentMidiTime >= this.totalDuration) {
            if (this.midiLoop) {
                this.midiStartTime = now;
                this.scheduledIndex = 0;
            } else {
                this.stopBgm();
                return;
            }
        }

        const loopOffsetTime = now - this.midiStartTime;

        while (this.scheduledIndex < this.currentTrackNotes.length) {
            const item = this.currentTrackNotes[this.scheduledIndex];
            if (item.time <= loopOffsetTime + lookahead) {
                const playAt = this.midiStartTime + item.time;
                if (playAt >= now - 0.05) {
                    this.playSynthNote(
                        Math.max(now, playAt),
                        item.note,
                        item.duration,
                        item.velocity,
                        item.channel,
                        window.currentGameStyle || 'classic'
                    );
                }
                this.scheduledIndex++;
            } else {
                break;
            }
        }

        // 次回スケジュール
        this.playbackTimer = setTimeout(() => {
            this.scheduleNotes(window.currentGameStyle);
        }, 100);
    }

    // ==========================================
    // プリセット BGM データ
    // ==========================================

    loadPresetBgm(name) {
        this.stopBgm();
        this.currentPreset = name;

        if (name === 'medley') {
            this.currentTrackNotes = this.getMedleyData();
        } else if (name === 'korobeiniki') {
            this.currentTrackNotes = this.getKorobeinikiData();
        } else if (name === 'troika') {
            this.currentTrackNotes = this.getTroikaData();
        } else if (name === 'woodland') {
            this.currentTrackNotes = this.getWoodlandData();
        } else {
            this.currentTrackNotes = this.getMedleyData();
        }

        // 全体の長さを算出
        this.totalDuration = Math.max(...this.currentTrackNotes.map(n => n.time + n.duration), 1);
    }

    /**
     * コロブチカ ＆ トロイカ の豪華メドレー
     */
    getMedleyData() {
        const koroNotes = this.getKorobeinikiData();
        const troikaNotes = this.getTroikaData();

        // コロブチカの終了時間を基準にトロイカをスムーズに連結（0.3秒のブレイク）
        const koroEnd = Math.max(...koroNotes.map(n => n.time + n.duration));
        const offset = koroEnd + 0.3;

        const shiftedTroika = troikaNotes.map(n => ({
            ...n,
            time: n.time + offset
        }));

        const combined = [...koroNotes, ...shiftedTroika];
        return combined.sort((a, b) => a.time - b.time);
    }

    /**
     * コロブチカ（Tetris Theme A）- 和音・対旋律強化版
     */
    getKorobeinikiData() {
        const bpm = 144;
        const beat = 60 / bpm;
        const eighth = beat / 2; // 8分音符

        const notes = [];

        // ヘルパー: ノート追加
        const addNote = (timeEighth, note, durEighth, vel = 95, ch = 0) => {
            notes.push({
                time: timeEighth * eighth,
                note: note,
                duration: durEighth * eighth * 0.9,
                velocity: vel,
                channel: ch
            });
        };

        // ヘルパー: 和音コード追加 (裏拍のポルカ伴奏)
        const addChord = (timeEighth, chordNotes, durEighth = 1.0, vel = 60) => {
            chordNotes.forEach(n => {
                notes.push({
                    time: timeEighth * eighth,
                    note: n,
                    duration: durEighth * eighth * 0.85,
                    velocity: vel,
                    channel: 2
                });
            });
        };

        // 16小節分のメロディ [note, lenInEighths]
        const melodyPhrases = [
            // 小節 1〜8 (1周目)
            [76, 2], [71, 1], [72, 1], [74, 2], [72, 1], [71, 1], // E5, B4, C5, D5, C5, B4
            [69, 2], [69, 1], [72, 1], [76, 2], [74, 1], [72, 1], // A4, A4, C5, E5, D5, C5
            [71, 3], [72, 1], [74, 2], [76, 2],                   // B4, C5, D5, E5
            [72, 2], [69, 2], [69, 4],                             // C5, A4, A4

            [74, 3], [77, 1], [81, 2], [79, 1], [77, 1],          // D5, F5, A5, G5, F5
            [76, 3], [72, 1], [76, 2], [74, 1], [72, 1],          // E5, C5, E5, D5, C5
            [71, 2], [71, 1], [72, 1], [74, 2], [76, 2],          // B4, B4, C5, D5, E5
            [72, 2], [69, 2], [69, 4],                             // C5, A4, A4

            // 小節 9〜16 (2周目・リピート展開)
            [76, 2], [71, 1], [72, 1], [74, 2], [72, 1], [71, 1],
            [69, 2], [69, 1], [72, 1], [76, 2], [74, 1], [72, 1],
            [71, 3], [72, 1], [74, 2], [76, 2],
            [72, 2], [69, 2], [69, 4],

            [74, 3], [77, 1], [81, 2], [79, 1], [77, 1],
            [76, 3], [72, 1], [76, 2], [74, 1], [72, 1],
            [71, 2], [71, 1], [72, 1], [74, 2], [76, 2],
            [72, 2], [69, 2], [69, 4]
        ];

        let mTime = 0;
        for (const [n, len] of melodyPhrases) {
            addNote(mTime, n, len, 95, 0);
            mTime += len;
        }

        // 2周目（小節9〜16: mTime 64〜128）のハーモニー対旋律 (channel 3)
        const harmonyPhrases = [
            [72, 2], [68, 1], [69, 1], [71, 2], [69, 1], [68, 1],
            [64, 2], [64, 1], [69, 1], [72, 2], [71, 1], [69, 1],
            [68, 3], [69, 1], [71, 2], [68, 2],
            [69, 2], [64, 2], [64, 4],

            [69, 3], [74, 1], [77, 2], [76, 1], [74, 1], // サビ高音ハモり
            [72, 3], [69, 1], [72, 2], [71, 1], [69, 1],
            [68, 2], [68, 1], [69, 1], [71, 2], [71, 2],
            [69, 2], [64, 2], [64, 4]
        ];

        let hTime = 64; // 9小節目からスタート
        for (const [n, len] of harmonyPhrases) {
            addNote(hTime, n, len, 75, 3);
            hTime += len;
        }

        // 16小節分のコード進行 & ベース設定 (1小節 = 8 eighths)
        // [コード和音ノート配列, ベース1, ベース2]
        const barPatterns = [
            // 1〜8小節
            [[68, 74, 76], 40, 47], // 1: E7 (G#4, D5, E5) / Bass E2, B2
            [[69, 72, 76], 45, 40], // 2: Am (A4, C5, E5) / Bass A2, E2
            [[68, 74, 76], 47, 40], // 3: E7
            [[69, 72, 76], 45, 45], // 4: Am
            [[65, 69, 74], 38, 45], // 5: Dm (F4, A4, D5) / Bass D2, A2
            [[64, 69, 72], 45, 40], // 6: Am
            [[68, 71, 76], 40, 47], // 7: E7
            [[69, 72, 76], 45, 45], // 8: Am
            // 9〜16小節 (リピート)
            [[68, 74, 76], 40, 47], // 9: E7
            [[69, 72, 76], 45, 40], // 10: Am
            [[68, 74, 76], 47, 40], // 11: E7
            [[69, 72, 76], 45, 45], // 12: Am
            [[65, 69, 74], 38, 45], // 13: Dm
            [[64, 69, 72], 45, 40], // 14: Am
            [[68, 71, 76], 40, 47], // 15: E7
            [[69, 72, 76], 45, 45]  // 16: Am
        ];

        barPatterns.forEach((pat, bIdx) => {
            const barStart = bIdx * 8;
            const [chordNotes, bass1, bass2] = pat;

            // ロシアンポルカ ベースライン (ズン・ズン)
            addNote(barStart + 0, bass1, 1.8, 80, 1);
            addNote(barStart + 4, bass2, 1.8, 80, 1);

            // ロシアンポルカ 和音裏拍伴奏 (チャッチャ・チャッチャ)
            addChord(barStart + 2, chordNotes, 1.2, 60);
            addChord(barStart + 3, chordNotes, 0.8, 48);
            addChord(barStart + 6, chordNotes, 1.2, 60);
            addChord(barStart + 7, chordNotes, 0.8, 48);
        });

        // 小節17: 華やかなキメ (終止打音フィルイン)
        const finStart = 16 * 8; // 128 eighths
        addNote(finStart + 0, 45, 1.8, 90, 1); // Bass A2
        addChord(finStart + 0, [69, 72, 76, 81], 1.8, 80);
        addNote(finStart + 4, 33, 2.5, 95, 1); // Bass A1
        addChord(finStart + 4, [69, 72, 76, 81], 2.5, 90);

        return notes.sort((a, b) => a.time - b.time);
    }

    /**
     * トロイカ（Troika - ロシア民謡）- 疾走感と重厚和音アレンジ
     */
    getTroikaData() {
        const bpm = 144;
        const beat = 60 / bpm;
        const eighth = beat / 2;

        const notes = [];

        const addNote = (timeEighth, note, durEighth, vel = 95, ch = 0) => {
            notes.push({
                time: timeEighth * eighth,
                note: note,
                duration: durEighth * eighth * 0.9,
                velocity: vel,
                channel: ch
            });
        };

        const addChord = (timeEighth, chordNotes, durEighth = 1.0, vel = 60) => {
            chordNotes.forEach(n => {
                notes.push({
                    time: timeEighth * eighth,
                    note: n,
                    duration: durEighth * eighth * 0.85,
                    velocity: vel,
                    channel: 2
                });
            });
        };

        // イントロ弱起 (2 eighths)
        addNote(0, 64, 1.8, 85, 0); // E4 弱起「ゆー」

        // 1番（Aパート・小節1〜8）メロディ
        // offset: 2 eighths
        const m1 = [
            // 1: 雪の白樺 (Am)
            [69, 2], [69, 1], [69, 1], [68, 1], [69, 1], [71, 2], // A4, A4, A4, G#4, A4, B4
            // 2: 並木 (E7)
            [68, 2], [64, 4], [64, 2],                             // G#4, E4, E4 (弱起)
            // 3: 夕日が映える (C)
            [72, 2], [72, 1], [72, 1], [71, 1], [69, 1], [71, 2], // C5, C5, C5, B4, A4, B4
            // 4: 映える (E7)
            [71, 6], [64, 2],                                     // B4, E4 (弱起)
            // 5: 走れトロイカ (Am)
            [69, 2], [71, 1], [72, 1], [71, 1], [69, 1], [64, 2], // A4, B4, C5, B4, A4, E4
            // 6: 朗らかに (Dm)
            [65, 2], [69, 1], [69, 1], [67, 1], [65, 1], [62, 2], // F4, A4, A4, G4, F4, D4
            // 7: 鈴の音高く (E7)
            [64, 2], [68, 2], [71, 2], [68, 2],                   // E4, G#4, B4, G#4
            // 8: 高く (Am)
            [69, 6], [76, 2]                                      // A4, E5 (2番弱起「ゆー」)
        ];

        let tTime = 2;
        for (const [n, len] of m1) {
            addNote(tTime, n, len, 95, 0);
            tTime += len;
        }

        // 2番（Bパート・小節9〜16）メロディ（オクターブ高音で高らかに！）
        const m2 = [
            // 9: 雪の白樺 (Am)
            [81, 2], [81, 1], [81, 1], [80, 1], [81, 1], [83, 2], // A5, A5, A5, G#5, A5, B5
            // 10: 並木 (E7)
            [80, 2], [76, 4], [76, 2],                             // G#5, E5, E5
            // 11: 夕日が映える (C)
            [84, 2], [84, 1], [84, 1], [83, 1], [81, 1], [83, 2], // C6, C6, C6, B5, A5, B5
            // 12: 映える (E7)
            [83, 6], [76, 2],                                     // B5, E5
            // 13: 走れトロイカ (Am)
            [81, 2], [83, 1], [84, 1], [83, 1], [81, 1], [76, 2], // A5, B5, C6, B5, A5, E5
            // 14: 朗らかに (Dm)
            [77, 2], [81, 1], [81, 1], [79, 1], [77, 1], [74, 2], // F5, A5, A5, G5, F5, D5
            // 15: 鈴の音高く (E7)
            [76, 2], [80, 2], [83, 2], [80, 2],                   // E5, G#5, B5, G#5
            // 16: 高く (Am)
            [81, 4], [81, 2], [81, 2]
        ];

        for (const [n, len] of m2) {
            addNote(tTime, n, len, 98, 0);
            tTime += len;
        }

        // 2番の華やかなハーモニー (channel 3)
        const h2 = [
            // 9
            [72, 2], [72, 1], [72, 1], [71, 1], [72, 1], [74, 2], // C5, C5, C5, B4, C5, D5
            // 10
            [71, 2], [68, 4], [68, 2],
            // 11
            [76, 2], [76, 1], [76, 1], [74, 1], [72, 1], [74, 2], // E5, E5, E5, D5, C5, D5
            // 12
            [74, 6], [68, 2],
            // 13
            [72, 2], [74, 1], [76, 1], [74, 1], [72, 1], [69, 2], // C5, D5, E5, D5, C5, A4
            // 14
            [69, 2], [74, 1], [74, 1], [72, 1], [69, 1], [65, 2], // A4, D5, D5, C5, A4, F4
            // 15
            [68, 2], [71, 2], [74, 2], [71, 2],                   // G#4, B4, D5, B4
            // 16
            [72, 4], [72, 2], [72, 2]
        ];

        let hTime = 66; // 9小節目の開始位置 (2 + 64)
        for (const [n, len] of h2) {
            addNote(hTime, n, len, 78, 3);
            hTime += len;
        }

        // コード伴奏とベース（16小節分）
        const troikaBars = [
            // 1番
            [[69, 72, 76], 45, 40], // 1: Am
            [[68, 74, 76], 40, 47], // 2: E7
            [[67, 72, 76], 48, 43], // 3: C
            [[68, 74, 76], 40, 47], // 4: E7
            [[69, 72, 76], 45, 40], // 5: Am
            [[65, 69, 74], 38, 45], // 6: Dm
            [[68, 71, 76], 40, 47], // 7: E7
            [[69, 72, 76], 45, 45], // 8: Am
            // 2番
            [[69, 72, 76], 45, 40], // 9: Am
            [[68, 74, 76], 40, 47], // 10: E7
            [[67, 72, 76], 48, 43], // 11: C
            [[68, 74, 76], 40, 47], // 12: E7
            [[69, 72, 76], 45, 40], // 13: Am
            [[65, 69, 74], 38, 45], // 14: Dm
            [[68, 71, 76], 40, 47], // 15: E7
            [[69, 72, 76], 45, 45]  // 16: Am
        ];

        troikaBars.forEach((bar, idx) => {
            const bStart = 2 + idx * 8;
            const [chordNotes, b1, b2] = bar;

            // 軽快なベース
            addNote(bStart + 0, b1, 1.8, 80, 1);
            addNote(bStart + 4, b2, 1.8, 80, 1);

            // リズミカルな和音カッティング
            addChord(bStart + 2, chordNotes, 1.2, 62);
            addChord(bStart + 3, chordNotes, 0.8, 50);
            addChord(bStart + 6, chordNotes, 1.2, 62);
            addChord(bStart + 7, chordNotes, 0.8, 50);
        });

        // 終止キメ打音
        const endStart = 2 + 16 * 8; // 130 eighths
        addNote(endStart + 0, 45, 2.0, 95, 1);
        addChord(endStart + 0, [69, 72, 76, 81], 2.0, 85);
        addNote(endStart + 4, 33, 2.5, 100, 1);
        addChord(endStart + 4, [69, 72, 76, 81], 2.5, 95);

        return notes.sort((a, b) => a.time - b.time);
    }

    /**
     * 木漏れ日（Woodland Melody - アコースティック木工風）
     */
    getWoodlandData() {
        const bpm = 112;
        const beat = 60 / bpm;
        const eighth = beat / 2;

        const melody = [
            [67, 2], [71, 2], [74, 2], [76, 2], [74, 4], [71, 4],
            [69, 2], [72, 2], [76, 2], [79, 2], [76, 4], [72, 4],
            [67, 2], [71, 2], [74, 2], [76, 2], [74, 2], [71, 2], [69, 2], [67, 2],
            [69, 4], [71, 4], [67, 8],

            [74, 2], [76, 2], [79, 2], [81, 2], [79, 4], [76, 4],
            [72, 2], [74, 2], [76, 2], [79, 2], [76, 4], [72, 4],
            [67, 2], [71, 2], [74, 2], [76, 2], [74, 2], [71, 2], [69, 2], [71, 2],
            [67, 8], [67, 8]
        ];

        const bass = [
            [43, 4], [55, 4], [50, 4], [55, 4],
            [45, 4], [57, 4], [52, 4], [57, 4],
            [43, 4], [55, 4], [50, 4], [55, 4],
            [45, 4], [47, 4], [43, 8],

            [48, 4], [60, 4], [55, 4], [60, 4],
            [45, 4], [57, 4], [52, 4], [57, 4],
            [43, 4], [55, 4], [50, 4], [55, 4],
            [43, 8], [43, 8]
        ];

        const notes = [];
        let currTime = 0;
        for (const [n, len] of melody) {
            notes.push({
                time: currTime,
                note: n,
                duration: len * eighth * 0.95,
                velocity: 85,
                channel: 0
            });
            currTime += len * eighth;
        }

        let bassTime = 0;
        for (const [n, len] of bass) {
            notes.push({
                time: bassTime,
                note: n,
                duration: len * eighth * 0.85,
                velocity: 60,
                channel: 1
            });
            bassTime += len * eighth;
        }

        return notes.sort((a, b) => a.time - b.time);
    }

    // ==========================================
    // MIDI ファイル (SMF) パーサー
    // ==========================================

    /**
     * ArrayBuffer から SMF (Format 0/1) をパース
     */
    parseMidi(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        let offset = 0;

        function readString(len) {
            let str = '';
            for (let i = 0; i < len; i++) {
                str += String.fromCharCode(view.getUint8(offset++));
            }
            return str;
        }

        const headerChunk = readString(4);
        if (headerChunk !== 'MThd') {
            throw new Error('有効なMIDIファイル(MThdヘッダー)ではありません');
        }

        const headerLength = view.getUint32(offset);
        offset += 4;
        const formatType = view.getUint16(offset);
        offset += 2;
        const numTracks = view.getUint16(offset);
        offset += 2;
        const timeDivision = view.getUint16(offset);
        offset += 2;

        offset += (headerLength - 6); // 余分なヘッダがあればスキップ

        let ticksPerBeat = timeDivision;
        if (timeDivision & 0x8000) {
            ticksPerBeat = 120; // SMPTE代替デフォルト
        }

        const tracks = [];

        // トラック読み込み
        for (let t = 0; t < numTracks; t++) {
            if (offset >= view.byteLength) break;
            const trackHeader = readString(4);
            if (trackHeader !== 'MTrk') {
                break;
            }
            const trackLength = view.getUint32(offset);
            offset += 4;
            const trackEnd = offset + trackLength;

            const events = [];
            let tick = 0;
            let runningStatus = 0;

            while (offset < trackEnd && offset < view.byteLength) {
                // 可変長数値 (deltaTime)
                let delta = 0;
                while (true) {
                    const b = view.getUint8(offset++);
                    delta = (delta << 7) | (b & 0x7F);
                    if (!(b & 0x80)) break;
                }
                tick += delta;

                let status = view.getUint8(offset);
                if (status >= 0x80) {
                    offset++;
                    runningStatus = status;
                } else {
                    status = runningStatus;
                }

                const eventType = status & 0xF0;
                const channel = status & 0x0F;

                if (eventType === 0x80) { // Note Off
                    const note = view.getUint8(offset++);
                    const vel = view.getUint8(offset++);
                    events.push({ tick, type: 'noteOff', note, velocity: vel, channel });
                } else if (eventType === 0x90) { // Note On
                    const note = view.getUint8(offset++);
                    const vel = view.getUint8(offset++);
                    if (vel === 0) {
                        events.push({ tick, type: 'noteOff', note, velocity: 0, channel });
                    } else {
                        events.push({ tick, type: 'noteOn', note, velocity: vel, channel });
                    }
                } else if (eventType === 0xA0 || eventType === 0xB0 || eventType === 0xE0) {
                    offset += 2; // Polyphonic aftertouch, CC, Pitch bend
                } else if (eventType === 0xC0 || eventType === 0xD0) {
                    offset += 1; // Program change, Channel pressure
                } else if (status === 0xFF) { // Meta Event
                    const metaType = view.getUint8(offset++);
                    let len = 0;
                    while (true) {
                        const b = view.getUint8(offset++);
                        len = (len << 7) | (b & 0x7F);
                        if (!(b & 0x80)) break;
                    }
                    if (metaType === 0x51 && len === 3) { // テンポ変更 (マイクロ秒/四分音符)
                        const uspb = (view.getUint8(offset) << 16) | (view.getUint8(offset + 1) << 8) | view.getUint8(offset + 2);
                        events.push({ tick, type: 'tempo', uspb });
                    }
                    offset += len;
                } else if (status === 0xF0 || status === 0xF7) { // SysEx
                    let len = 0;
                    while (true) {
                        const b = view.getUint8(offset++);
                        len = (len << 7) | (b & 0x7F);
                        if (!(b & 0x80)) break;
                    }
                    offset += len;
                }
            }

            tracks.push(events);
            offset = trackEnd;
        }

        // イベントを時間に変換（テンポマップ適用）
        return this.convertMidiEventsToNotes(tracks, ticksPerBeat);
    }

    /**
     * MIDIトラックイベントを再生用ノート配列に統合
     */
    convertMidiEventsToNotes(tracks, ticksPerBeat) {
        // すべてのイベントをタイムライン順に並べ替え
        const allEvents = [];
        tracks.forEach(tr => {
            tr.forEach(ev => allEvents.push(ev));
        });
        allEvents.sort((a, b) => a.tick - b.tick);

        let currentUspb = 500000; // 120 BPM = 500,000 µs
        let currentSeconds = 0;
        let lastTick = 0;

        const openNotes = new Map(); // key: `${channel}_${note}`
        const finishedNotes = [];

        for (const ev of allEvents) {
            const deltaTicks = ev.tick - lastTick;
            currentSeconds += (deltaTicks / ticksPerBeat) * (currentUspb / 1000000);
            lastTick = ev.tick;

            if (ev.type === 'tempo') {
                currentUspb = ev.uspb;
            } else if (ev.type === 'noteOn') {
                const key = `${ev.channel}_${ev.note}`;
                if (openNotes.has(key)) {
                    // 直前の同一音を閉じる
                    const prev = openNotes.get(key);
                    finishedNotes.push({
                        time: prev.time,
                        note: prev.note,
                        duration: Math.max(0.05, currentSeconds - prev.time),
                        velocity: prev.velocity,
                        channel: prev.channel
                    });
                }
                openNotes.set(key, {
                    time: currentSeconds,
                    note: ev.note,
                    velocity: ev.velocity,
                    channel: ev.channel
                });
            } else if (ev.type === 'noteOff') {
                const key = `${ev.channel}_${ev.note}`;
                if (openNotes.has(key)) {
                    const prev = openNotes.get(key);
                    finishedNotes.push({
                        time: prev.time,
                        note: prev.note,
                        duration: Math.max(0.05, currentSeconds - prev.time),
                        velocity: prev.velocity,
                        channel: prev.channel
                    });
                    openNotes.delete(key);
                }
            }
        }

        // 残ったオープンノートを閉じる
        openNotes.forEach(prev => {
            finishedNotes.push({
                time: prev.time,
                note: prev.note,
                duration: 0.25,
                velocity: prev.velocity,
                channel: prev.channel
            });
        });

        finishedNotes.sort((a, b) => a.time - b.time);
        return finishedNotes;
    }

    /**
     * 外部 MIDI ファイル (File / Blob) を読み込んで再生準備
     */
    async loadMidiFile(file) {
        this.init();
        const arrayBuffer = await file.arrayBuffer();
        const notes = this.parseMidi(arrayBuffer);
        if (notes.length === 0) {
            throw new Error('MIDIファイルに演奏可能なノートが含まれていません');
        }

        this.stopBgm();
        this.currentTrackNotes = notes;
        this.totalDuration = Math.max(...notes.map(n => n.time + n.duration), 1);
        this.currentPreset = 'custom';
        this.startBgm();
        return { noteCount: notes.length, duration: this.totalDuration };
    }
}

// グローバルインスタンス
window.soundController = new SoundController();
