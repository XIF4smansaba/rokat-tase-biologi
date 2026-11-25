// ==========================================
// KONFIGURASI & STATE PERMAINAN
// ==========================================
let gameMode = "ai";
let totalDistance = 1800;
let aiLevel = "normal";
let colorP1 = "#10b981";
let colorP2 = "#0284c7";
let isRacing = false;
let isCountingDown = false;
let startTime = 0;
let tickCount = 0;
let shakeP1 = 0;
let shakeP2 = 0;

// ==========================================
// SISTEM SOUND EFFECT (WEB AUDIO API)
// ==========================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") audioCtx.resume();
}

const SoundFX = {
    tone(freq, dur, type = "triangle", vol = 0.08, slideTo = null) {
        try {
            initAudio();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            if (slideTo) {
                osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + dur);
            }
            gain.gain.setValueAtTime(vol, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + dur);
        } catch (e) {}
    },
    noise(dur, filterFreq = 800, vol = 0.08) {
        try {
            initAudio();
            const bufferSize = audioCtx.sampleRate * dur;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const src = audioCtx.createBufferSource();
            src.buffer = buffer;

            const filter = audioCtx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.value = filterFreq;

            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(vol, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);

            src.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            src.start();
        } catch (e) {}
    },
    countdown(isGo) {
        this.tone(isGo ? 880 : 440, isGo ? 0.35 : 0.18, "square", 0.08);
    },
    turbo(combo) {
        const base = 520 + Math.min(combo, 6) * 55;
        this.tone(base, 0.16, "sine", 0.09, base * 1.45);
        setTimeout(() => this.tone(base * 1.25, 0.22, "triangle", 0.08, base * 1.8), 70);
        this.noise(0.35, 1400, 0.1);
    },
    wrong() {
        this.tone(200, 0.22, "sawtooth", 0.08, 120);
    },
    bump() {
        this.tone(130, 0.14, "sawtooth", 0.1, 60);
        this.noise(0.12, 350, 0.09);
    },
    laneSwitch() {
        this.noise(0.14, 1100, 0.05);
        this.tone(320, 0.08, "sine", 0.04, 420);
    },
    win() {
        [523, 659, 784, 1046].forEach((f, i) => {
            setTimeout(() => this.tone(f, 0.25, "triangle", 0.09), i * 110);
        });
    }
};

// Bank Soal Biologi Cadangan
let bankSoal = [
    { tanya: "Organel sel yang berfungsi menghasilkan energi ATP adalah...", opsi: ["Mitokondria", "Ribosom", "Lisosom", "Badan Golgi"], benar: 0 },
    { tanya: "Proses tumbuhan membuat makanan dengan cahaya matahari disebut...", opsi: ["Respirasi", "Adaptasi", "Fotosintesis", "Transpirasi"], benar: 2 },
    { tanya: "Hutan pesisir yang melindungi pantai Madura dari abrasi adalah...", opsi: ["Hutan Hujan", "Hutan Mangrove", "Sabana", "Stepa"], benar: 1 }
];

fetch("/api/soal")
    .then(r => r.json())
    .then(data => { if (Array.isArray(data) && data.length) bankSoal = data; })
    .catch(() => console.log("Menggunakan bank soal lokal."));

// ==========================================
// INISIALISASI SCENE 3D THREE.JS
// ==========================================
const canvas3D = document.getElementById("threeCanvas");
const renderer = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x28b8f5);
scene.fog = new THREE.Fog(0x28b8f5, 90, 320);

const camP1 = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.5, 450);
const camP2 = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.5, 450);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x0ea5e9, 0.88);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.78);
dirLight.position.set(40, 80, 30);
scene.add(dirLight);

const waterGeo = new THREE.PlaneGeometry(120, 3500);
const waterMat = new THREE.MeshLambertMaterial({ color: 0x00c8f8 });
const waterMesh = new THREE.Mesh(waterGeo, waterMat);
waterMesh.rotation.x = -Math.PI / 2;
waterMesh.position.set(0, 0, -1000);
scene.add(waterMesh);

// ==========================================
// SISTEM PARTIKEL 3D (BUIH AIR & API TURBO)
// ==========================================
const particles = [];
const particleGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);

function spawnParticle(x, y, z, isTurbo) {
    const color = isTurbo
        ? (Math.random() < 0.5 ? 0xf97316 : 0xfacc15)
        : 0xffffff;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.set(x + (Math.random() - 0.5) * 1.4, y, z);
    scene.add(mesh);

    particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.12,
        vy: isTurbo ? 0.08 + Math.random() * 0.12 : 0.04 + Math.random() * 0.06,
        vz: isTurbo ? 0.35 + Math.random() * 0.2 : 0.15,
        life: isTurbo ? 22 : 16,
        maxLife: isTurbo ? 22 : 16
    });
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.life--;
        const ratio = p.life / p.maxLife;
        p.mesh.scale.setScalar(0.4 + ratio * 0.9);
        p.mesh.material.opacity = ratio;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            p.mesh.material.dispose();
            particles.splice(i, 1);
        }
    }
}

// ==========================================
// TEKSTUR KHAS MADURA (KAOS SAKERA MERAH-PUTIH)
// ==========================================
function buatTeksturSakera() {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    for (let y = 0; y < 64; y += 16) {
        ctx.fillStyle = (y / 16) % 2 === 0 ? "#dc2626" : "#ffffff";
        ctx.fillRect(0, y, 64, 16);
    }
    return new THREE.CanvasTexture(c);
}
const sakeraTex = buatTeksturSakera();
const sakeraMat = new THREE.MeshLambertMaterial({ map: sakeraTex });

// ==========================================
// PEMBANGUNAN ARENA 3D (20 SEGMEN TRIBUN ROKAT TASÈ')
// ==========================================
const arenaGroup = new THREE.Group();
scene.add(arenaGroup);

const marlenaColors = [0xfacc15, 0xec4899, 0xef4444, 0xa855f7, 0x10b981, 0xf97316];
const segLength = 30;
const numSegments = 20;
const trackSegments = [];

function buatSegmenArena(zPos) {
    const seg = new THREE.Group();
    seg.position.z = zPos;

    [-1, 1].forEach(side => {
        const baseX = side * 16;

        const bank = new THREE.Mesh(
            new THREE.BoxGeometry(4, 1.2, segLength),
            new THREE.MeshLambertMaterial({ color: 0x22c55e })
        );
        bank.position.set(baseX, 0.6, 0);
        seg.add(bank);

        for (let step = 0; step < 3; step++) {
            const stand = new THREE.Mesh(
                new THREE.BoxGeometry(3.2, 1.4 + step * 1.1, segLength),
                new THREE.MeshLambertMaterial({ color: step % 2 === 0 ? 0xf59e0b : 0xf97316 })
            );
            stand.position.set(baseX + side * (3.2 + step * 2.8), (1.4 + step * 1.1) / 2 + 0.4, 0);
            seg.add(stand);

            for (let p = -12; p <= 12; p += 4.2) {
                const isSakera = Math.random() > 0.45;
                const bodyMat = isSakera
                    ? sakeraMat
                    : new THREE.MeshLambertMaterial({ color: marlenaColors[Math.floor(Math.random() * marlenaColors.length)] });

                const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 1.1), bodyMat);
                const py = 1.4 + step * 1.1 + 1.1;
                const px = baseX + side * (3.2 + step * 2.8);
                body.position.set(px, py, p);
                seg.add(body);

                const head = new THREE.Mesh(
                    new THREE.SphereGeometry(0.52, 8, 8),
                    new THREE.MeshLambertMaterial({ color: 0xfde047 })
                );
                head.position.set(px, py + 1.02, p);
                seg.add(head);

                const hat = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.54, 0.54, 0.24, 8),
                    new THREE.MeshLambertMaterial({ color: isSakera ? 0xb91c1c : 0x1e293b })
                );
                hat.position.set(px, py + 1.35, p);
                seg.add(hat);
            }
        }

        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(10.5, 0.6, segLength),
            new THREE.MeshLambertMaterial({ color: 0xe11d48 })
        );
        roof.position.set(baseX + side * 6.2, 8.2, 0);
        roof.rotation.z = side * -0.08;
        seg.add(roof);

        for (let pz = -10; pz <= 10; pz += 10) {
            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.18, 7.6, 6),
                new THREE.MeshLambertMaterial({ color: 0xffffff })
            );
            pole.position.set(baseX + side * 1.4, 4.2, pz);
            seg.add(pole);

            const banner = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 4.2, 1.4),
                new THREE.MeshLambertMaterial({ color: marlenaColors[Math.floor(Math.random() * marlenaColors.length)] })
            );
            banner.position.set(baseX + side * 0.9, 5.2, pz);
            seg.add(banner);
        }
    });

    const buoyGeo = new THREE.SphereGeometry(0.55, 10, 10);
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const redMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });

    for (let bz = -12; bz <= 12; bz += 8) {
        [-7.5, -2.5, 2.5, 7.5].forEach((bx, idx) => {
            const buoy = new THREE.Mesh(buoyGeo, (bz + idx) % 2 === 0 ? whiteMat : redMat);
            buoy.position.set(bx, 0.2, bz);
            seg.add(buoy);
        });
    }

    for (let fx = -12; fx <= 12; fx += 3) {
        const flag = new THREE.Mesh(
            new THREE.ConeGeometry(0.6, 1.4, 3),
            new THREE.MeshLambertMaterial({ color: marlenaColors[Math.abs(fx) % marlenaColors.length] })
        );
        flag.rotation.x = Math.PI;
        flag.position.set(fx, 11.5 - Math.cos(fx * 0.12) * 1.2, 0);
        seg.add(flag);
    }

    return seg;
}

for (let i = 0; i < numSegments; i++) {
    const seg = buatSegmenArena(60 - i * segLength);
    trackSegments.push(seg);
    arenaGroup.add(seg);
}

// ==========================================
// GERBANG GARIS FINISH 3D KOTAK-KOTAK
// ==========================================
const finishArch = new THREE.Group();
const pillarGeo = new THREE.CylinderGeometry(0.8, 0.8, 12, 10);
const pillarMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
leftPillar.position.set(-14, 6, 0);
const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
rightPillar.position.set(14, 6, 0);
finishArch.add(leftPillar, rightPillar);

const checkerCanvas = document.createElement("canvas");
checkerCanvas.width = 512;
checkerCanvas.height = 128;
const cctx = checkerCanvas.getContext("2d");
for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 16; c++) {
        cctx.fillStyle = (r + c) % 2 === 0 ? "#0f172a" : "#ffffff";
        cctx.fillRect(c * 32, r * 32, 32, 32);
    }
}
const checkerTex = new THREE.CanvasTexture(checkerCanvas);
const finishBanner = new THREE.Mesh(
    new THREE.BoxGeometry(28.5, 3.2, 0.6),
    new THREE.MeshBasicMaterial({ map: checkerTex })
);
finishBanner.position.set(0, 10.2, 0);
finishArch.add(finishBanner);
finishArch.position.z = -1800;
scene.add(finishArch);

// ==========================================
// MODEL PERAHU JUKUNG & KARAKTER SAKERA / MARLENA DETAIL
// ==========================================
let racers = [];

function buatKarakterMadura(isSakera, rz) {
    const charGroup = new THREE.Group();
    charGroup.position.set(0, 0.9, rz);

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfcd34d });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

    if (isSakera) {
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.85), sakeraMat);
        torso.position.y = 0.55;
        charGroup.add(torso);

        const vestBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.16, 0.2), darkMat);
        vestBack.position.set(0, 0.55, 0.38);
        const vestL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.16, 0.9), darkMat);
        vestL.position.set(-0.48, 0.55, 0);
        const vestR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.16, 0.9), darkMat);
        vestR.position.set(0.48, 0.55, 0);
        charGroup.add(vestBack, vestL, vestR);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), skinMat);
        head.position.y = 1.45;
        charGroup.add(head);

        const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), darkMat);
        mustache.position.set(0, 1.32, -0.44);
        charGroup.add(mustache);

        const odhengMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
        const odheng = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.28, 12), odhengMat);
        odheng.position.y = 1.74;
        const simpul = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 4), odhengMat);
        simpul.position.set(0, 1.98, 0.15);
        charGroup.add(odheng, simpul);
    } else {
        const kebayaMat = new THREE.MeshLambertMaterial({ color: 0xe11d48 });
        const selendangMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });

        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.15, 0.8), kebayaMat);
        torso.position.y = 0.55;
        charGroup.add(torso);

        const selendang = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.22, 0.86), selendangMat);
        selendang.position.y = 0.72;
        selendang.rotation.z = 0.35;
        charGroup.add(selendang);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 12), skinMat);
        head.position.y = 1.45;
        charGroup.add(head);

        const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.49, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), darkMat);
        hairTop.position.y = 1.48;
        const sanggul = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), darkMat);
        sanggul.position.set(0, 1.48, 0.44);

        const melati = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
        melati.position.set(0.24, 1.56, 0.46);
        const tusukEmas = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.06, 0.06), selendangMat);
        tusukEmas.position.set(0, 1.62, 0.44);
        charGroup.add(hairTop, sanggul, melati, tusukEmas);
    }

    const armMat = isSakera ? darkMat : new THREE.MeshLambertMaterial({ color: 0xe11d48 });
    [-0.78, 0.78].forEach(ax => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.26, 0.26), armMat);
        arm.position.set(ax, 0.75, 0);
        charGroup.add(arm);
    });

    return charGroup;
}

function buatModelPerahu3D(hexColor, outfit) {
    const boat = new THREE.Group();

    const hullMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(hexColor) });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.95, 7.4), hullMat);
    hull.position.y = 0.48;
    boat.add(hull);

    const trimMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
    [-1.28, 1.28].forEach(tx => {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 7.4), trimMat);
        trim.position.set(tx, 0.85, 0);
        boat.add(trim);
    });

    const prow = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.8, 4), trimMat);
    prow.rotation.x = -Math.PI / 2;
    prow.rotation.y = Math.PI / 4;
    prow.position.set(0, 0.58, -5.0);
    boat.add(prow);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    mast.position.set(0, 2.0, -3.7);
    boat.add(mast);

    const flagRed = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 1.1), new THREE.MeshLambertMaterial({ color: 0xef4444 }));
    flagRed.position.set(0, 3.1, -3.15);
    const flagWhite = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 1.1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    flagWhite.position.set(0, 2.55, -3.15);
    boat.add(flagRed, flagWhite);

    const oars = [];
    const positions = [-2.0, 0.1, 2.2];
    positions.forEach((rz, idx) => {
        const isSakera = outfit === "sakera" ? (idx !== 1) : (idx === 1);
        const karakter = buatKarakterMadura(isSakera, rz);
        boat.add(karakter);

        [-1, 1].forEach(s => {
            const oar = new THREE.Mesh(
                new THREE.BoxGeometry(0.18, 0.12, 3.5),
                new THREE.MeshLambertMaterial({ color: 0x92400e })
            );
            oar.position.set(s * 1.8, 0.9, rz + 0.5);
            oar.rotation.y = s * 0.6;
            oar.rotation.x = 0.3;
            boat.add(oar);
            oars.push({ mesh: oar, side: s });
        });
    });

    const wake = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 3.6, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
    );
    wake.rotation.x = Math.PI / 2;
    wake.position.set(0, 0.35, 5.2);
    boat.add(wake);

    return { group: boat, oars, wake };
}

function buatPembalap() {
    racers.forEach(r => { if (r.model) scene.remove(r.model.group); });

    const namaP1 = document.getElementById("inputNamaP1").value.trim() || "Sakera 1";
    const namaP2 = document.getElementById("inputNamaP2").value.trim() || "Marlena 2";

    const configs = [
        { id: 1, name: namaP1, isHuman: true, laneX: -5, color: colorP1, outfit: "sakera", qIdx: 0, aiOffset: 0, aiBoostRate: 0 },
        { id: 2, name: gameMode === "duel" ? namaP2 : "Perahu Pamekasan", isHuman: gameMode === "duel", laneX: 5, color: gameMode === "duel" ? colorP2 : "#ef4444", outfit: "marlena", qIdx: 1, aiOffset: 3.5, aiBoostRate: 0.012 },
        { id: 3, name: "Perahu Sumenep", isHuman: false, laneX: -10, color: "#a855f7", outfit: "sakera", qIdx: 0, aiOffset: 0, aiBoostRate: 0.008 },
        { id: 4, name: "Perahu Sampang", isHuman: false, laneX: 10, color: "#f97316", outfit: "marlena", qIdx: 0, aiOffset: -4.0, aiBoostRate: 0.005 }
    ];

    racers = configs.map(cfg => {
        const model = buatModelPerahu3D(cfg.color, cfg.outfit);
        model.group.position.set(cfg.laneX, 0, 0);
        scene.add(model.group);
        return {
            ...cfg,
            x: cfg.laneX,
            targetX: cfg.laneX,
            dist: 0,
            speed: 28,
            turbo: 0,
            combo: 0,
            correct: 0,
            totalAns: 0,
            finishTime: null,
            bumpCooldown: 0,
            model
        };
    });
}

// ==========================================
// CEK TABRAKAN SAMPING (ANTI TEMBUS JALUR)
// ==========================================
function apakahJalurAman(racer, calonX) {
    if (calonX < -10 || calonX > 10) return false;

    for (let other of racers) {
        if (other.id === racer.id) continue;

        const bentrokX = Math.abs(other.x - calonX) < 3.8 || Math.abs(other.targetX - calonX) < 3.8;
        const bentrokZ = Math.abs(other.dist - racer.dist) < 11.5;

        if (bentrokX && bentrokZ) return false;
    }
    return true;
}

// ==========================================
// MENU, COUNTDOWN, & KONTROL KUIS
// ==========================================
function pilihMode(mode) {
    gameMode = mode;
    document.getElementById("btnModeAI").classList.toggle("active", mode === "ai");
    document.getElementById("btnModeDuel").classList.toggle("active", mode === "duel");
    document.getElementById("boxP2").style.display = mode === "duel" ? "block" : "none";
    document.getElementById("keyboardGuide").style.display = mode === "duel" ? "grid" : "none";
    document.getElementById("playerSetupGrid").classList.toggle("single", mode === "ai");
    document.getElementById("labelP1").innerText = mode === "duel" ? "NAMA PEMAIN 1 (KIRI / ATAS)" : "NAMA PEMAIN";

    const btn = document.getElementById("btnMulai");
    btn.innerText = mode === "duel" ? "👥 Mulai Duel 2 Layar!" : "🏁 Mulai Balapan (1 vs AI)";
    btn.className = mode === "duel" ? "start-main-btn purple" : "start-main-btn green";
}

function pilihWarna(pNum, hex, el) {
    if (pNum === 1) colorP1 = hex;
    else colorP2 = hex;
    const parent = document.getElementById(pNum === 1 ? "colorsP1" : "colorsP2");
    parent.querySelectorAll(".color-dot").forEach(b => b.classList.remove("active"));
    el.classList.add("active");
}

function mulaiBalapan() {
    initAudio();
    totalDistance = parseInt(document.getElementById("selectJarak").value);
    aiLevel = document.getElementById("selectAI").value;
    finishArch.position.z = -totalDistance;

    document.getElementById("menuOverlay").style.display = "none";
    document.getElementById("resultOverlay").style.display = "none";
    document.getElementById("gameContainer").style.display = "flex";

    const isDuel = gameMode === "duel";
    document.getElementById("splitArena").classList.toggle("duel-active", isDuel);
    document.getElementById("paneP2").style.display = isDuel ? "flex" : "none";
    document.getElementById("hudStatsP2").style.display = isDuel ? "flex" : "none";

    buatPembalap();
    resetSegmenArena();

    document.getElementById("tagP1").innerText = `⚡ Jawab benar = Turbo (${racers[0].name}: 1-4 • A/D)`;
    document.getElementById("tagP2").innerText = `⚡ Jawab benar = Turbo (${racers[1].name}: 7-0 • ◀/▶)`;
    tampilkanSoal(1);
    if (isDuel) tampilkanSoal(2);

    isRacing = false;
    isCountingDown = true;

    const cdEl = document.getElementById("countdownText");
    const steps = ["3", "2", "1", "GAS!"];
    let idx = 0;

    function nextCount() {
        if (!isCountingDown) return;
        cdEl.style.display = "block";
        cdEl.innerText = steps[idx];
        cdEl.style.animation = "none";
        void cdEl.offsetWidth;
        cdEl.style.animation = "popCount 0.8s ease-out";
        SoundFX.countdown(idx === 3);

        idx++;
        if (idx < steps.length) {
            setTimeout(nextCount, 850);
        } else {
            setTimeout(() => {
                if (!isCountingDown) return;
                cdEl.style.display = "none";
                isCountingDown = false;
                startTime = performance.now();
                isRacing = true;
            }, 600);
        }
    }
    nextCount();
}

function resetSegmenArena() {
    for (let i = 0; i < numSegments; i++) {
        trackSegments[i].position.z = 60 - i * segLength;
    }
}

function kembaliKeMenu() {
    isRacing = false;
    isCountingDown = false;
    document.getElementById("countdownText").style.display = "none";
    document.getElementById("gameContainer").style.display = "none";
    document.getElementById("resultOverlay").style.display = "none";
    document.getElementById("menuOverlay").style.display = "flex";
    buatPembalap();
    resetSegmenArena();
}

function tampilkanSoal(playerNum) {
    const p = racers[playerNum - 1];
    const soal = bankSoal[p.qIdx % bankSoal.length];
    document.getElementById(`soalP${playerNum}`).innerText = soal.tanya;

    const opsiContainer = document.getElementById(`opsiP${playerNum}`);
    opsiContainer.innerHTML = "";
    const keys = playerNum === 1 ? ["1.", "2.", "3.", "4."] : ["[7]", "[8]", "[9]", "[0]"];

    soal.opsi.forEach((teks, idx) => {
        const btn = document.createElement("button");
        btn.className = `opt-btn opt-c${idx}`;
        btn.innerText = `${keys[idx]} ${teks}`;
        btn.onclick = () => jawabSoal(playerNum, idx, btn);
        opsiContainer.appendChild(btn);
    });
}

function jawabSoal(playerNum, pilihanIdx, btnEl) {
    if (!isRacing) return;
    const p = racers[playerNum - 1];
    const soal = bankSoal[p.qIdx % bankSoal.length];
    p.totalAns++;

    if (pilihanIdx === soal.benar) {
        p.correct++;
        p.combo++;
        p.turbo = 48; // ~0.8 detik
        p.speed = Math.min(76, 48 + p.combo * 5);
        SoundFX.turbo(p.combo);

        fetch("/api/evaluasi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ combo: p.combo, jarak: totalDistance - Math.floor(p.dist), tingkat: aiLevel })
        }).catch(() => {});
    } else {
        p.combo = 0;
        p.speed = Math.max(22, p.speed - 8);
        SoundFX.wrong();
        if (btnEl) btnEl.classList.add("opt-wrong");
    }

    p.qIdx++;
    setTimeout(() => tampilkanSoal(playerNum), 180);
}

function geserJalur(playerNum, arah) {
    if (!racers[playerNum - 1] || !isRacing) return;
    const p = racers[playerNum - 1];
    const calonX = Math.max(-10, Math.min(10, p.targetX + arah * 5));

    if (calonX !== p.targetX && apakahJalurAman(p, calonX)) {
        p.targetX = calonX;
        SoundFX.laneSwitch();
    } else {
        SoundFX.bump();
        if (playerNum === 1) shakeP1 = 8;
        if (playerNum === 2) shakeP2 = 8;
    }
}

window.addEventListener("keydown", e => {
    if (!isRacing) return;
    if (["1", "2", "3", "4"].includes(e.key)) {
        const btns = document.querySelectorAll("#opsiP1 .opt-btn");
        if (btns[parseInt(e.key) - 1]) btns[parseInt(e.key) - 1].click();
    }
    if (e.key === "a" || e.key === "A") geserJalur(1, -1);
    if (e.key === "d" || e.key === "D") geserJalur(1, 1);

    if (gameMode === "duel") {
        const mapP2 = { "7": 0, "8": 1, "9": 2, "0": 3 };
        if (e.key in mapP2) {
            const btns = document.querySelectorAll("#opsiP2 .opt-btn");
            if (btns[mapP2[e.key]]) btns[mapP2[e.key]].click();
        }
        if (e.key === "ArrowLeft") geserJalur(2, -1);
        if (e.key === "ArrowRight") geserJalur(2, 1);
    }
});

// ==========================================
// LOOP ANIMASI 3D UTAMA
// ==========================================
function animate3D() {
    requestAnimationFrame(animate3D);
    tickCount++;

    const inMenu = document.getElementById("menuOverlay").style.display !== "none";

    // KONFIGURASI KESULITAN AI (Target Win Rate: Mudah 90%, Normal 60%, Susah 30%)
    const aiConfig = {
        mudah:  { base: 23, boostMult: 0.2, boostAdd: 6,  boostDur: 25 }, // 90% Menang: AI lebih lambat dari laju normal pemain
        normal: { base: 30, boostMult: 0.9, boostAdd: 14, boostDur: 35 }, // 60% Menang: Imbang, butuh jawaban benar rutin untuk unggul
        sulit:  { base: 39, boostMult: 2.2, boostAdd: 18, boostDur: 42 }  // 30% Menang: AI kencang & sering boost, wajib kombo cepat
    }[aiLevel] || { base: 30, boostMult: 0.9, boostAdd: 14, boostDur: 35 };

    racers.forEach((r, idx) => {
        if (r.bumpCooldown > 0) r.bumpCooldown--;

        if (inMenu) {
            r.dist += (26 + idx * 1.5) * 0.012;
            r.x = Math.sin(tickCount * 0.012 + idx * 1.5) * 7;
        } else if (isRacing && r.finishTime === null) {
            r.x += (r.targetX - r.x) * 0.12;

            if (!r.isHuman) {
                if (r.turbo > 0) {
                    r.turbo--;
                } else {
                    const targetAiSpeed = (aiConfig.base + r.aiOffset) + Math.sin(tickCount * 0.025 + r.id * 2) * 3.5;
                    r.speed += (targetAiSpeed - r.speed) * 0.08;

                    if (Math.random() < r.aiBoostRate * aiConfig.boostMult) {
                        r.turbo = aiConfig.boostDur;
                        r.speed = targetAiSpeed + aiConfig.boostAdd;
                    }
                }

                if ((tickCount + r.id * 37) % 130 === 0) {
                    const arahAcak = Math.random() < 0.5 ? -5 : 5;
                    const calonX = r.targetX + arahAcak;
                    if (apakahJalurAman(r, calonX)) r.targetX = calonX;
                }
            } else {
                if (r.turbo > 0) r.turbo--;
                else r.speed = Math.max(28, r.speed - 0.85);
            }

            let nextDist = r.dist + r.speed * 0.012;

            // LOGIKA ANTI-NEMBUS DEPAN
            for (let other of racers) {
                if (other.id === r.id) continue;
                const jalurSama = Math.abs(other.x - r.x) < 3.4;
                const diDepan = other.dist > r.dist && (other.dist - nextDist) < 10.2;

                if (jalurSama && diDepan) {
                    nextDist = Math.max(r.dist, other.dist - 10.2);
                    r.speed = Math.min(r.speed, other.speed * 0.92);

                    if (r.bumpCooldown === 0) {
                        r.bumpCooldown = 25;
                        if (r.isHuman) {
                            SoundFX.bump();
                            if (r.id === 1) shakeP1 = 10;
                            if (r.id === 2) shakeP2 = 10;
                        } else {
                            if (apakahJalurAman(r, r.targetX - 5)) r.targetX -= 5;
                            else if (apakahJalurAman(r, r.targetX + 5)) r.targetX += 5;
                        }
                    }
                }
            }

            r.dist = nextDist;
            if (r.dist >= totalDistance) {
                r.dist = totalDistance;
                r.finishTime = ((performance.now() - startTime) / 1000).toFixed(1);
            }
        }

        r.model.group.position.set(r.x, Math.sin(tickCount * 0.08 + idx) * 0.12, -r.dist);
        const oarSpeed = r.turbo > 0 ? 0.38 : 0.14;
        r.model.oars.forEach(o => {
            o.mesh.rotation.x = 0.25 + Math.sin(tickCount * oarSpeed) * 0.35;
        });

        const isTurbo = r.turbo > 0;
        r.model.wake.material.color.setHex(isTurbo ? 0xf97316 : 0xffffff);
        r.model.wake.scale.set(isTurbo ? 1.8 : 1, isTurbo ? 2.3 : 1, 1);

        if ((isRacing || inMenu) && tickCount % (isTurbo ? 2 : 5) === 0) {
            spawnParticle(r.x, 0.5, -r.dist + 4.2, isTurbo);
        }
    });

    updateParticles();

    const trailZ = Math.max(...racers.map(r => -r.dist));
    trackSegments.forEach(seg => {
        if (seg.position.z > trailZ + 65) {
            seg.position.z -= numSegments * segLength;
        }
    });
    waterMesh.position.z = trailZ - 600;

    if (isRacing) {
        const ranking = [...racers].sort((a, b) => {
            if (a.finishTime !== null && b.finishTime !== null) {
                return parseFloat(a.finishTime) - parseFloat(b.finishTime);
            }
            if (a.finishTime !== null) return -1;
            if (b.finishTime !== null) return 1;
            return b.dist - a.dist;
        });

        const posP1 = ranking.findIndex(r => r.id === 1) + 1;
        const posP2 = ranking.findIndex(r => r.id === 2) + 1;

        document.getElementById("hudPosP1").innerText = `${posP1}/4`;
        document.getElementById("hudSpeedP1").innerText = Math.round(racers[0].speed);
        document.getElementById("hudComboP1").innerText = `${racers[0].combo}x`;

        const pct1 = Math.min(100, (racers[0].dist / totalDistance) * 100);
        document.getElementById("progressBarP1").style.width = `${pct1}%`;
        document.getElementById("hudDistText").innerText = `${Math.floor(racers[0].dist)}m / ${totalDistance}m`;

        racers.forEach((r, i) => {
            const m = document.getElementById(`markerP${i + 1}`);
            if (m) m.style.left = `${Math.min(100, (r.dist / totalDistance) * 100)}%`;
        });

        if (gameMode === "duel") {
            document.getElementById("hudPosP2").innerText = `${posP2}/4`;
            document.getElementById("hudSpeedP2").innerText = Math.round(racers[1].speed);
            document.getElementById("hudComboP2").innerText = `${racers[1].combo}x`;
        }

        const p1Done = racers[0].finishTime !== null;
        const p2Done = gameMode === "duel" ? racers[1].finishTime !== null : true;
        if ((gameMode === "ai" && p1Done) || (gameMode === "duel" && (p1Done || p2Done))) {
            SoundFX.win();
            tampilkanHasil(ranking);
        }
    }

    // KAMERA LEBAR OTOMATIS UNTUK HP (PORTRAIT) & LAPTOP
    const W = window.innerWidth;
    const H = window.innerHeight;
    const isMobile = W <= 768;
    const isPortrait = W < H;

    const baseFov = isPortrait ? (gameMode === "duel" && !inMenu ? 68 : 80) : 58;
    const turboFov = baseFov + 10;

    const camY = isPortrait ? (gameMode === "duel" && !inMenu ? 8.5 : 10.0) : 7.5;
    const camZ = isPortrait ? (gameMode === "duel" && !inMenu ? 16.5 : 20.5) : 13.5;
    const camXFollow = isPortrait ? 0.35 : 0.65;
    const lookY = isPortrait ? 0.6 : 2.0;

    const targetFov1 = (!inMenu && racers[0].turbo > 0) ? turboFov : baseFov;
    camP1.fov += (targetFov1 - camP1.fov) * 0.1;
    const s1x = shakeP1 > 0 ? (Math.random() - 0.5) * 0.5 : 0;
    const s1y = shakeP1 > 0 ? (Math.random() - 0.5) * 0.5 : 0;
    if (shakeP1 > 0) shakeP1--;

    const targetFov2 = (!inMenu && racers[1].turbo > 0) ? turboFov : baseFov;
    camP2.fov += (targetFov2 - camP2.fov) * 0.1;
    const s2x = shakeP2 > 0 ? (Math.random() - 0.5) * 0.5 : 0;
    const s2y = shakeP2 > 0 ? (Math.random() - 0.5) * 0.5 : 0;
    if (shakeP2 > 0) shakeP2--;

    renderer.setScissorTest(false);

    if (!inMenu && gameMode === "duel") {
        renderer.setScissorTest(true);

        camP1.position.set(racers[0].x * camXFollow + s1x, camY + s1y, -racers[0].dist + camZ);
        camP1.lookAt(racers[0].x * 0.25, lookY, -racers[0].dist - 22);

        camP2.position.set(racers[1].x * camXFollow + s2x, camY + s2y, -racers[1].dist + camZ);
        camP2.lookAt(racers[1].x * 0.25, lookY, -racers[1].dist - 22);

        if (isMobile) {
            camP1.aspect = W / (H / 2);
            camP1.updateProjectionMatrix();
            renderer.setViewport(0, H / 2, W, H / 2);
            renderer.setScissor(0, H / 2, W, H / 2);
            renderer.render(scene, camP1);

            camP2.aspect = W / (H / 2);
            camP2.updateProjectionMatrix();
            renderer.setViewport(0, 0, W, H / 2);
            renderer.setScissor(0, 0, W, H / 2);
            renderer.render(scene, camP2);
        } else {
            camP1.aspect = (W / 2) / H;
            camP1.updateProjectionMatrix();
            renderer.setViewport(0, 0, W / 2, H);
            renderer.setScissor(0, 0, W / 2, H);
            renderer.render(scene, camP1);

            camP2.aspect = (W / 2) / H;
            camP2.updateProjectionMatrix();
            renderer.setViewport(W / 2, 0, W / 2, H);
            renderer.setScissor(W / 2, 0, W / 2, H);
            renderer.render(scene, camP2);
        }
    } else {
        camP1.aspect = W / H;
        camP1.updateProjectionMatrix();
        if (inMenu) {
            camP1.position.set(Math.sin(tickCount * 0.008) * 5, isPortrait ? 10 : 8.5, -racers[0].dist + (isPortrait ? 20 : 15));
            camP1.lookAt(0, 1.5, -racers[0].dist - 20);
        } else {
            camP1.position.set(racers[0].x * camXFollow + s1x, camY + s1y, -racers[0].dist + camZ);
            camP1.lookAt(racers[0].x * 0.25, lookY, -racers[0].dist - 22);
        }
        renderer.setViewport(0, 0, W, H);
        renderer.render(scene, camP1);
    }
}

function tampilkanHasil(ranking) {
    isRacing = false;
    const p1 = racers[0];
    const p2 = racers[1];
    const r1 = ranking.findIndex(r => r.id === 1) + 1;
    const r2 = ranking.findIndex(r => r.id === 2) + 1;
    const trophyEl = document.getElementById("trophyIcon");

    if (gameMode === "duel") {
        const pemenang = r1 < r2 ? p1.name : p2.name;
        trophyEl.innerText = "🏆";
        document.getElementById("winnerTitle").innerText = `${pemenang} MENANG DUEL! 🎉`;
        document.getElementById("winnerSubtitle").innerText = `Duel 2 Layar · ${p1.name} (Juara #${r1}) vs ${p2.name} (Juara #${r2})`;
        document.getElementById("resBoxP2").style.display = "block";
    } else {
        const medali = {
            1: { icon: "🏆", judul: "JUARA 1! LUAR BIASA!" },
            2: { icon: "🥈", judul: "JUARA 2! HEBAT!" },
            3: { icon: "🥉", judul: "JUARA 3! BAGUS!" },
            4: { icon: "⛵", judul: "PERINGKAT 4! AYO COBA LAGI!" }
        };
        trophyEl.innerText = medali[r1].icon;
        document.getElementById("winnerTitle").innerText = medali[r1].judul;
        document.getElementById("winnerSubtitle").innerText = `${p1.name} · Mode 1 Pemain vs AI (${totalDistance}m)`;
        document.getElementById("resBoxP2").style.display = "none";
    }

    const acc1 = p1.totalAns ? Math.round((p1.correct / p1.totalAns) * 100) : 0;
    document.getElementById("resNameP1").innerText = `🚤 ${p1.name.toUpperCase()} (PERINGKAT #${r1})`;
    document.getElementById("resTimeP1").innerText = p1.finishTime ? `${p1.finishTime}s` : `${Math.floor(p1.dist)}m`;
    document.getElementById("resCorrectP1").innerText = `${p1.correct} / ${p1.totalAns}`;
    document.getElementById("resAccP1").innerText = `${acc1}%`;

    if (gameMode === "duel") {
        const acc2 = p2.totalAns ? Math.round((p2.correct / p2.totalAns) * 100) : 0;
        document.getElementById("resNameP2").innerText = `🚤 ${p2.name.toUpperCase()} (PERINGKAT #${r2})`;
        document.getElementById("resTimeP2").innerText = p2.finishTime ? `${p2.finishTime}s` : `${Math.floor(p2.dist)}m`;
        document.getElementById("resCorrectP2").innerText = `${p2.correct} / ${p2.totalAns}`;
        document.getElementById("resAccP2").innerText = `${acc2}%`;
    }

    document.getElementById("resultOverlay").style.display = "flex";
}

window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
});

buatPembalap();
animate3D();