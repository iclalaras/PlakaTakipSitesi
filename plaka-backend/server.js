const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool, initDb } = require("./database");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../plaka-frontend")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../plaka-frontend/index.html"));
});

const normalizePlate = (value) => {
    if (!value) return "";
    return value.toString().trim().toUpperCase().replace(/\s+/g, "");
};

const normalizeFirm = (value) => {
    if (!value) return "";
    return value.toString().trim().toUpperCase();
};

const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const queryRows = async (sql, params = []) => {
    const result = await pool.query(sql, params);
    return result.rows;
};

const queryOne = async (sql, params = []) => {
    const result = await pool.query(sql, params);
    return result.rows[0];
};

const getUserId = (req) => {
    const raw = req.query.kullanici_id || req.body.kullanici_id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
};

// === AUTH ===
app.post("/auth/register", async (req, res) => {
    const { kullanici_adi, sifre } = req.body;
    if (!kullanici_adi || !sifre) return res.status(400).json({ message: "Eksik bilgi" });

    try {
        const hashedPassword = await bcrypt.hash(sifre, 10);
        const result = await pool.query(
            `INSERT INTO kullanicilar (kullanici_adi, sifre) VALUES ($1, $2) RETURNING id`,
            [kullanici_adi, hashedPassword]
        );
        res.json({ message: "Kayıt başarılı", id: result.rows[0].id });
    } catch (err) {
        if (err.message.includes("unique")) return res.status(400).json({ message: "Kullanıcı adı var" });
        res.status(500).json({ error: err.message });
    }
});

app.post("/auth/login", async (req, res) => {
    const { kullanici_adi, sifre } = req.body;

    try {
        const user = await queryOne(`SELECT * FROM kullanicilar WHERE kullanici_adi = $1`, [kullanici_adi]);
        if (!user) return res.status(401).json({ message: "Kullanıcı bulunamadı" });

        const isMatch = await bcrypt.compare(sifre, user.sifre);
        if (!isMatch) return res.status(401).json({ message: "Şifre hatalı" });

        res.json({
            message: "Giriş başarılı",
            user: { id: user.id, kullanici_adi: user.kullanici_adi }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === FIRMALAR ===
app.get("/firmalar", async (req, res) => {
    const kullanici_id = getUserId(req);
    if (!kullanici_id) return res.status(400).json({ message: "Kullanıcı gerekli" });
    try {
        const rows = await queryRows(
            "SELECT * FROM firmalar WHERE aktif = TRUE AND kullanici_id = $1 ORDER BY firma_adi ASC",
            [kullanici_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/firmalar", async (req, res) => {
    const firma_adi = normalizeFirm(req.body.firma_adi);
    const kullanici_id = getUserId(req);
    if (!firma_adi || !kullanici_id) return res.status(400).json({ message: "Firma adı ve kullanıcı gerekli" });

    try {
        const result = await pool.query(
            "INSERT INTO firmalar (firma_adi, kullanici_id, aktif) VALUES ($1, $2, TRUE) RETURNING id",
            [firma_adi, kullanici_id]
        );
        res.json({ message: "Firma eklendi", id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/firmalar/sil", async (req, res) => {
    const firma_adi = normalizeFirm(req.body.firma_adi);
    const firma_id = req.body.firma_id;
    const kullanici_id = getUserId(req);
    if (!kullanici_id || (!firma_adi && !firma_id)) return res.status(400).json({ message: "Firma ve kullanıcı gerekli" });

    try {
        let firm = null;
        if (firma_id) {
            firm = await queryOne("SELECT id FROM firmalar WHERE id = $1 AND kullanici_id = $2", [firma_id, kullanici_id]);
        } else {
            firm = await queryOne("SELECT id FROM firmalar WHERE firma_adi = $1 AND kullanici_id = $2", [firma_adi, kullanici_id]);
        }
        if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

        await pool.query("UPDATE firmalar SET aktif = FALSE WHERE id = $1", [firm.id]);
        await pool.query("UPDATE araclar SET aktif = FALSE WHERE firma_id = $1", [firm.id]);
        res.json({ message: "Firma ve bağlı plakalar pasife alındı" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === ARAÇLAR ===
app.get("/araclar", async (req, res) => {
    const kullanici_id = getUserId(req);
    if (!kullanici_id) return res.status(400).json({ message: "Kullanıcı gerekli" });
    try {
        const rows = await queryRows(
            `SELECT a.id, a.plaka, a.firma_id, f.firma_adi
             FROM araclar a
             LEFT JOIN firmalar f ON f.id = a.firma_id
             WHERE a.aktif = TRUE AND a.kullanici_id = $1
             ORDER BY a.plaka ASC`
            , [kullanici_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/araclar", async (req, res) => {
    const plaka = normalizePlate(req.body.plaka);
    const firma_id = req.body.firma_id;
    const kullanici_id = getUserId(req);
    if (!plaka || !firma_id || !kullanici_id) return res.status(400).json({ message: "Plaka, firma ve kullanıcı gerekli" });

    try {
        const result = await pool.query(
            "INSERT INTO araclar (plaka, firma_id, kullanici_id, aktif) VALUES ($1, $2, $3, TRUE) RETURNING id",
            [plaka, firma_id, kullanici_id]
        );
        res.json({ message: "Araç eklendi", id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/araclar/sil", async (req, res) => {
    const plaka = normalizePlate(req.body.plaka);
    const arac_id = req.body.arac_id;
    const kullanici_id = getUserId(req);
    if (!kullanici_id || (!plaka && !arac_id)) return res.status(400).json({ message: "Plaka ve kullanıcı gerekli" });

    try {
        let arac = null;
        if (arac_id) {
            arac = await queryOne("SELECT id FROM araclar WHERE id = $1 AND kullanici_id = $2", [arac_id, kullanici_id]);
        } else {
            arac = await queryOne("SELECT id FROM araclar WHERE plaka = $1 AND kullanici_id = $2", [plaka, kullanici_id]);
        }
        if (!arac) return res.status(404).json({ message: "Plaka bulunamadı" });

        await pool.query("UPDATE araclar SET aktif = FALSE WHERE id = $1", [arac.id]);
        res.json({ message: "Plaka pasife alındı" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === KAYITLAR ===
app.post("/kayitlar", async (req, res) => {
    const arac_id = req.body.arac_id;
    const kullanici_id = getUserId(req);
    const satis_miktari = toNumber(req.body.satis_miktari);
    const tarih = req.body.tarih;

    if (!arac_id || !kullanici_id) return res.status(400).json({ message: "Araç ve kullanıcı gerekli" });
    if (satis_miktari === null || satis_miktari <= 0) return res.status(400).json({ message: "Satış 0'dan büyük olmalı" });

    const hakedis = Number((satis_miktari * 0.25).toFixed(2));

    try {
        const sql = tarih
            ? `INSERT INTO kayitlar (arac_id, kullanici_id, satis_miktari, hakedis, tarih) VALUES ($1, $2, $3, $4, $5) RETURNING id`
            : `INSERT INTO kayitlar (arac_id, kullanici_id, satis_miktari, hakedis) VALUES ($1, $2, $3, $4) RETURNING id`;
        const params = tarih
            ? [arac_id, kullanici_id, satis_miktari, hakedis, tarih]
            : [arac_id, kullanici_id, satis_miktari, hakedis];
        const result = await pool.query(sql, params);
        res.json({ message: "Kayıt eklendi", id: result.rows[0].id, hakedis });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/kayitlar/sil", async (req, res) => {
    const { id } = req.body;
    const kullanici_id = getUserId(req);
    if (!id || !kullanici_id) return res.status(400).json({ message: "Kayıt ve kullanıcı gerekli" });
    try {
        const result = await pool.query("DELETE FROM kayitlar WHERE id = $1 AND kullanici_id = $2", [id, kullanici_id]);
        res.json({ message: "Kayıt silindi", deleted: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/kayitlar", async (req, res) => {
    const { baslangic, bitis } = req.query;
    const kullanici_id = getUserId(req);
    if (!kullanici_id) return res.status(400).json({ message: "Kullanıcı gerekli" });

    let sql = `SELECT k.id, k.arac_id, k.kullanici_id, k.satis_miktari, k.hakedis, k.tarih, a.plaka, f.firma_adi
               FROM kayitlar k
               JOIN araclar a ON a.id = k.arac_id
               LEFT JOIN firmalar f ON f.id = a.firma_id`;
    const params = [kullanici_id];
    let whereSql = " WHERE k.kullanici_id = $1";
    if (baslangic && bitis) {
        whereSql += ` AND k.tarih BETWEEN $2 AND $3`;
        params.push(baslangic, bitis);
    }

    sql += `${whereSql} ORDER BY k.tarih DESC, k.id DESC`;

    try {
        const rows = await queryRows(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === RAPORLAR ===
app.get("/rapor/plaka", async (req, res) => {
    const plaka = normalizePlate(req.query.plaka);
    const { baslangic, bitis, grup = "gun" } = req.query;
    const kullanici_id = getUserId(req);

    if (!plaka || !kullanici_id) return res.status(400).json({ message: "Plaka ve kullanıcı gerekli" });

    const where = [`k.kullanici_id = $1`, `a.plaka = $2`];
    const params = [kullanici_id, plaka];

    if (baslangic && bitis) {
        where.push(`k.tarih BETWEEN $3 AND $4`);
        params.push(baslangic, bitis);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const groupMap = {
        gun: "DATE(k.tarih)",
        ay: "to_char(k.tarih, 'YYYY-MM')",
        yil: "to_char(k.tarih, 'YYYY')"
    };
    const groupExpr = groupMap[grup] || groupMap.gun;

    try {
        const liste = await queryRows(
            `SELECT k.id, k.tarih, a.plaka, f.firma_adi, k.satis_miktari, k.hakedis
             FROM kayitlar k
             JOIN araclar a ON a.id = k.arac_id
             LEFT JOIN firmalar f ON f.id = a.firma_id
             ${whereSql}
             ORDER BY k.tarih DESC, k.id DESC`,
            params
        );

        const grafik = await queryRows(
            `SELECT ${groupExpr} AS period, SUM(k.satis_miktari) AS toplam_satis, SUM(k.hakedis) AS toplam_hakedis
             FROM kayitlar k
             JOIN araclar a ON a.id = k.arac_id
             ${whereSql}
             GROUP BY period
             ORDER BY period ASC`,
            params
        );

        res.json({ plaka, liste, grafik, grup });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/rapor/firma", async (req, res) => {
    const firma_adi = normalizeFirm(req.query.firma);
    const { baslangic, bitis, grup = "gun" } = req.query;
    const kullanici_id = getUserId(req);

    if (!firma_adi || !kullanici_id) return res.status(400).json({ message: "Firma ve kullanıcı gerekli" });

    try {
        const firm = await queryOne(
            `SELECT id, firma_adi FROM firmalar WHERE firma_adi = $1 AND kullanici_id = $2`,
            [firma_adi, kullanici_id]
        );
        if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

        const params = [kullanici_id, firm.id];
        let whereSql = `WHERE k.kullanici_id = $1 AND a.firma_id = $2`;

        if (baslangic && bitis) {
            whereSql += ` AND k.tarih BETWEEN $3 AND $4`;
            params.push(baslangic, bitis);
        }

        const groupMap = {
            gun: "DATE(k.tarih)",
            ay: "to_char(k.tarih, 'YYYY-MM')",
            yil: "to_char(k.tarih, 'YYYY')"
        };
        const groupExpr = groupMap[grup] || groupMap.gun;

        const liste = await queryRows(
            `SELECT DATE(k.tarih) AS tarih, SUM(k.satis_miktari) AS toplam_satis, SUM(k.hakedis) AS toplam_hakedis
             FROM kayitlar k
             JOIN araclar a ON a.id = k.arac_id
             ${whereSql}
             GROUP BY DATE(k.tarih)
             ORDER BY DATE(k.tarih) DESC`,
            params
        );

        const grafik = await queryRows(
            `SELECT ${groupExpr} AS period, SUM(k.satis_miktari) AS toplam_satis, SUM(k.hakedis) AS toplam_hakedis
             FROM kayitlar k
             JOIN araclar a ON a.id = k.arac_id
             ${whereSql}
             GROUP BY period
             ORDER BY period ASC`,
            params
        );

        res.json({ firma: firm.firma_adi, liste, grafik, grup });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/rapor/tarih", async (req, res) => {
    const { baslangic, bitis } = req.query;
    const kullanici_id = getUserId(req);
    if (!baslangic || !bitis || !kullanici_id) return res.status(400).json({ message: "Tarih ve kullanıcı gerekli" });

    try {
        const toplam = await queryOne(
            `SELECT SUM(k.satis_miktari) AS toplam_satis, SUM(k.hakedis) AS toplam_hakedis
             FROM kayitlar k
             WHERE k.kullanici_id = $1 AND k.tarih BETWEEN $2 AND $3`,
            [kullanici_id, baslangic, bitis]
        );

        const net_ciro = Number(((toplam?.toplam_satis || 0) - (toplam?.toplam_hakedis || 0)).toFixed(2));

        const firmalar = await queryRows(
            `SELECT f.firma_adi AS firma, SUM(k.satis_miktari - k.hakedis) AS net_ciro
             FROM kayitlar k
             JOIN araclar a ON a.id = k.arac_id
             LEFT JOIN firmalar f ON f.id = a.firma_id
             WHERE k.kullanici_id = $1 AND k.tarih BETWEEN $2 AND $3
             GROUP BY f.id
             ORDER BY net_ciro DESC`,
            [kullanici_id, baslangic, bitis]
        );

        const aylik = await queryRows(
            `SELECT to_char(k.tarih, 'YYYY-MM') AS period, SUM(k.satis_miktari - k.hakedis) AS net_ciro
             FROM kayitlar k
             WHERE k.kullanici_id = $1 AND k.tarih BETWEEN $2 AND $3
             GROUP BY period
             ORDER BY period ASC`,
            [kullanici_id, baslangic, bitis]
        );

        const yillik = await queryRows(
            `SELECT to_char(k.tarih, 'YYYY') AS period, SUM(k.satis_miktari - k.hakedis) AS net_ciro
             FROM kayitlar k
             WHERE k.kullanici_id = $1 AND k.tarih BETWEEN $2 AND $3
             GROUP BY period
             ORDER BY period ASC`,
            [kullanici_id, baslangic, bitis]
        );

        res.json({ baslangic, bitis, net_ciro, firmalar, aylik, yillik });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/rapor/grafik", async (req, res) => {
    const { gun_sayisi = 7 } = req.query;
    const kullanici_id = getUserId(req);
    if (!kullanici_id) return res.status(400).json({ message: "Kullanıcı gerekli" });
    try {
        const rows = await queryRows(
            `SELECT DATE(tarih) as gun, SUM(satis_miktari) as gunluk_satis
             FROM kayitlar
             WHERE kullanici_id = $1 AND tarih >= CURRENT_DATE - INTERVAL '${Number(gun_sayisi)} days'
             GROUP BY DATE(tarih)
             ORDER BY gun ASC`,
            [kullanici_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;

async function start() {
    try {
        await initDb();
        app.listen(PORT, () => {
            console.log(`Server çalışıyor → http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("Veritabanı başlatma hatası:", err);
        process.exit(1);
    }
}

start();
