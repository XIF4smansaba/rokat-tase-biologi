from flask import Flask, render_template, request, jsonify
import random

app = Flask(__name__)

# ==========================================
# BANK SOAL BIOLOGI SMA (VERSI MUDAH & RINGKAS DARI 5 PDF)
# ==========================================
BANK_SOAL_BIOLOGI = [
    # --- 1. BIOLOGI SEL ---
    {"tanya": "Ilmuwan yang pertama kali menemukan sel pada tahun 1665 adalah...", "opsi": ["Robert Hooke", "Charles Darwin", "Gregor Mendel", "Louis Pasteur"], "benar": 0},
    {"tanya": "Organel sel yang berfungsi menghasilkan energi (ATP) adalah...", "opsi": ["Ribosom", "Mitokondria", "Vakuola", "Lisosom"], "benar": 1},
    {"tanya": "Pusat kendali sel yang menyimpan informasi genetik (DNA) adalah...", "opsi": ["Sitoplasma", "Nukleus (Inti sel)", "Dinding sel", "Membran plasma"], "benar": 1},
    {"tanya": "Organel sel yang berfungsi sebagai tempat pembuatan (sintesis) protein adalah...", "opsi": ["Ribosom", "Mitokondria", "Kloroplas", "Vakuola"], "benar": 0},
    {"tanya": "Cairan yang mengisi bagian dalam sel di luar inti sel disebut...", "opsi": ["Sitoplasma", "Klorofil", "Kromosom", "Dinding sel"], "benar": 0},
    {"tanya": "Bagian sel yang hanya dimiliki sel tumbuhan dan tidak ada pada sel hewan adalah...", "opsi": ["Membran sel", "Mitokondria", "Dinding sel", "Nukleus"], "benar": 2},
    {"tanya": "Organel pada sel tumbuhan yang mengandung pigmen hijau untuk fotosintesis adalah...", "opsi": ["Lisosom", "Kloroplas", "Sentriol", "Ribosom"], "benar": 1},

    # --- 2. TRANSPOR MEMBRAN ---
    {"tanya": "Transpor membran yang TIDAK membutuhkan energi (ATP) disebut...", "opsi": ["Transpor aktif", "Transpor pasif", "Endositosis", "Eksositosis"], "benar": 1},
    {"tanya": "Transpor membran yang membutuhkan energi (ATP) karena melawan gradien konsentrasi adalah...", "opsi": ["Transpor aktif", "Transpor pasif", "Difusi", "Osmosis"], "benar": 0},
    {"tanya": "Perpindahan zat dari konsentrasi tinggi ke konsentrasi rendah disebut...", "opsi": ["Osmosis", "Difusi", "Eksositosis", "Fagositosis"], "benar": 1},
    {"tanya": "Perpindahan air melewati membran semipermeabel disebut...", "opsi": ["Difusi", "Osmosis", "Endositosis", "Eksositosis"], "benar": 1},
    {"tanya": "Proses pemasukan zat atau partikel ke dalam sel menggunakan vesikula disebut...", "opsi": ["Endositosis", "Eksositosis", "Osmosis", "Difusi"], "benar": 0},
    {"tanya": "Proses pengeluaran zat dari dalam sel ke luar sel disebut...", "opsi": ["Endositosis", "Fagositosis", "Eksositosis", "Pinositosis"], "benar": 2},
    {"tanya": "Proses sel 'memakan' partikel padat seperti bakteri disebut...", "opsi": ["Pinositosis", "Fagositosis", "Osmosis", "Difusi"], "benar": 1},

    # --- 3. JARINGAN HEWAN ---
    {"tanya": "Jaringan hewan yang berfungsi melapisi permukaan tubuh dan rongga organ adalah...", "opsi": ["Jaringan epitel", "Jaringan otot", "Jaringan saraf", "Jaringan tulang"], "benar": 0},
    {"tanya": "Jaringan ikat yang menghubungkan otot dengan tulang adalah...", "opsi": ["Ligamen", "Tendon", "Epitel", "Saraf"], "benar": 1},
    {"tanya": "Jaringan ikat yang menghubungkan tulang dengan tulang adalah...", "opsi": ["Tendon", "Ligamen", "Otot polos", "Kartilago"], "benar": 1},
    {"tanya": "Jenis otot yang hanya ditemukan pada organ jantung adalah...", "opsi": ["Otot polos", "Otot rangka", "Otot jantung", "Otot lurik"], "benar": 2},
    {"tanya": "Jenis otot yang bekerja secara sadar (sesuai kemauan kita) adalah...", "opsi": ["Otot polos", "Otot jantung", "Otot rangka", "Otot organ dalam"], "benar": 2},
    {"tanya": "Sel utama penyusun jaringan saraf yang menghantarkan impuls disebut...", "opsi": ["Neuron", "Eritrosit", "Osteosit", "Kondrosit"], "benar": 0},

    # --- 4. SISTEM GERAK ---
    {"tanya": "Dalam sistem gerak manusia, tulang berperan sebagai alat gerak...", "opsi": ["Aktif", "Pasif", "Bebas", "Sadar"], "benar": 1},
    {"tanya": "Dalam sistem gerak manusia, otot berperan sebagai alat gerak...", "opsi": ["Pasif", "Aktif", "Kaku", "Diam"], "benar": 1},
    {"tanya": "Jumlah tulang pada tubuh manusia dewasa adalah...", "opsi": ["106 tulang", "206 tulang", "306 tulang", "406 tulang"], "benar": 1},
    {"tanya": "Tulang dada dan tulang rusuk berfungsi melindungi organ...", "opsi": ["Otak", "Jantung dan paru-paru", "Ginjal", "Lambung"], "benar": 1},
    {"tanya": "Sendi yang terdapat pada siku dan lutut (bergerak satu arah) adalah...", "opsi": ["Sendi peluru", "Sendi engsel", "Sendi putar", "Sendi pelana"], "benar": 1},
    {"tanya": "Sendi yang terdapat pada bahu dan panggul (bergerak ke segala arah) adalah...", "opsi": ["Sendi engsel", "Sendi geser", "Sendi peluru", "Sendi kaku"], "benar": 2},
    {"tanya": "Gangguan berupa patah tulang dalam istilah biologi disebut...", "opsi": ["Fraktur", "Kifosis", "Lordosis", "Skoliosis"], "benar": 0},
    {"tanya": "Kondisi tulang menjadi rapuh dan keropos akibat kekurangan kalsium disebut...", "opsi": ["Osteoporosis", "Skoliosis", "Kram", "Terkilir"], "benar": 0},
    {"tanya": "Kelainan tulang belakang yang melengkung ke samping (kanan/kiri) disebut...", "opsi": ["Kifosis", "Lordosis", "Skoliosis", "Fraktur"], "benar": 2},

    # --- 5. SISTEM SIRKULASI ---
    {"tanya": "Organ yang berfungsi memompa darah ke seluruh tubuh adalah...", "opsi": ["Paru-paru", "Jantung", "Hati", "Ginjal"], "benar": 1},
    {"tanya": "Komponen darah yang berfungsi mengangkut oksigen ke seluruh tubuh adalah...", "opsi": ["Sel darah merah", "Sel darah putih", "Keping darah", "Plasma darah"], "benar": 0},
    {"tanya": "Komponen darah yang berfungsi melawan kuman dan infeksi penyakit adalah...", "opsi": ["Sel darah merah", "Sel darah putih", "Keping darah", "Hemoglobin"], "benar": 1},
    {"tanya": "Komponen darah yang berperan dalam proses pembekuan darah saat luka adalah...", "opsi": ["Eritrosit", "Leukosit", "Trombosit (Keping darah)", "Plasma"], "benar": 2},
    {"tanya": "Golongan darah yang disebut sebagai donor universal (bisa memberi ke semua golongan) adalah...", "opsi": ["Golongan A", "Golongan B", "Golongan AB", "Golongan O"], "benar": 3},
    {"tanya": "Gangguan sistem sirkulasi berupa tekanan darah tinggi di atas normal disebut...", "opsi": ["Anemia", "Hipotensi", "Hipertensi", "Hemofilia"], "benar": 2}
]

# ==========================================
# 1. ALGORITMA REKURSIF: Bonus Kecepatan Turbo Berjenjang (Combo)
# ==========================================
def hitung_bonus_combo_rekursif(combo):
    if combo <= 0:
        return 0
    return 6 + hitung_bonus_combo_rekursif(combo - 1)

# ==========================================
# 2. ALGORITMA GREEDY: Strategi Akselerasi Optimal Lawan AI
# ==========================================
def strategi_ai_greedy(sisa_jarak, tingkat):
    aksi = [
        {"nama": "Turbo Penuh", "biaya": 300, "boost": 18},
        {"nama": "Dayung Cepat", "biaya": 150, "boost": 10},
        {"nama": "Dayung Stabil", "biaya": 50, "boost": 5}
    ]
    terpilih = "Dayung Stabil"
    for a in aksi:
        if sisa_jarak >= a["biaya"]:
            terpilih = a["nama"]
            break

    if tingkat == "sulit":
        faktor = 1.25
    elif tingkat == "normal":
        faktor = 1.0
    else:
        faktor = 0.78

    return {"strategi": terpilih, "faktor_kecepatan": faktor}

# ==========================================
# 3. DYNAMIC PROGRAMMING: Efisiensi Stamina Pendayung per 100m
# ==========================================
def efisiensi_stamina_dp(jarak_total):
    step = max(1, jarak_total // 100)
    dp = [0] * (step + 1)
    for i in range(1, step + 1):
        dp[i] = dp[i - 1] + (10 if i % 2 == 0 else 15)
    return dp[step]

# ==========================================
# ROUTE HALAMAN & API JSON
# ==========================================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/soal", methods=["GET"])
def api_soal():
    soal_acak = BANK_SOAL_BIOLOGI.copy()
    random.shuffle(soal_acak)
    return jsonify(soal_acak)

@app.route("/api/evaluasi", methods=["POST"])
def api_evaluasi():
    data = request.json or {}
    combo = int(data.get("combo", 0))
    jarak = int(data.get("jarak", 1800))
    tingkat = data.get("tingkat", "normal")
    return jsonify({
        "bonus_turbo": hitung_bonus_combo_rekursif(min(combo, 5)),
        "ai_info": strategi_ai_greedy(jarak, tingkat),
        "stamina_optimal": efisiensi_stamina_dp(jarak)
    })

if __name__ == "__main__":
    app.run(debug=True)