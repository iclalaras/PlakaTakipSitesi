const { Pool } = require("pg");
require("dotenv").config(); // varsa kullanır, yoksa sorun çıkarmaz

const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://plaka_user:1234@localhost:5432/plaka";

// Production (Render.com vb.) ortamında SSL otomatik etkinleştirilir
const isProduction = process.env.NODE_ENV === "production" || (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost"));

const pool = new Pool({
    connectionString: connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

async function initDb() {
    // 1. Tablo Tanımları
    await pool.query(`
        CREATE TABLE IF NOT EXISTS kullanicilar (
            id SERIAL PRIMARY KEY,
            kullanici_adi TEXT NOT NULL UNIQUE,
            sifre TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS firmalar (
            id SERIAL PRIMARY KEY,
            firma_adi TEXT NOT NULL,
            kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
            aktif BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS araclar (
            id SERIAL PRIMARY KEY,
            plaka TEXT NOT NULL,
            firma_id INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
            kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
            aktif BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS kayitlar (
            id SERIAL PRIMARY KEY,
            arac_id INTEGER NOT NULL REFERENCES araclar(id) ON DELETE CASCADE,
            kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
            satis_miktari NUMERIC NOT NULL CHECK (satis_miktari >= 0),
            hakedis NUMERIC NOT NULL CHECK (hakedis >= 0),
            tarih DATE NOT NULL DEFAULT CURRENT_DATE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Geriye Dönük Uyumluluk ve Kısıtlama Güçlendirmeleri
    // Kullanıcılar
    await pool.query(`ALTER TABLE kullanicilar ALTER COLUMN kullanici_adi SET NOT NULL;`);
    await pool.query(`ALTER TABLE kullanicilar ALTER COLUMN sifre SET NOT NULL;`);
    await pool.query(`ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;`);

    // Firmalar
    await pool.query(`ALTER TABLE firmalar ALTER COLUMN firma_adi SET NOT NULL;`);
    await pool.query(`ALTER TABLE firmalar ALTER COLUMN kullanici_id SET NOT NULL;`);
    await pool.query(`ALTER TABLE firmalar ALTER COLUMN aktif SET NOT NULL;`);
    await pool.query(`ALTER TABLE firmalar ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
    await pool.query(`ALTER TABLE firmalar DROP CONSTRAINT IF EXISTS firmalar_firma_adi_key;`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS firmalar_kullanici_id_firma_adi_idx ON firmalar(kullanici_id, firma_adi);`);

    // Araçlar
    await pool.query(`ALTER TABLE araclar ALTER COLUMN plaka SET NOT NULL;`);
    await pool.query(`ALTER TABLE araclar ALTER COLUMN firma_id SET NOT NULL;`);
    await pool.query(`ALTER TABLE araclar ALTER COLUMN kullanici_id SET NOT NULL;`);
    await pool.query(`ALTER TABLE araclar ALTER COLUMN aktif SET NOT NULL;`);
    await pool.query(`ALTER TABLE araclar ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
    await pool.query(`ALTER TABLE araclar DROP CONSTRAINT IF EXISTS araclar_plaka_key;`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS araclar_kullanici_id_plaka_idx ON araclar(kullanici_id, plaka);`);

    // Kayıtlar
    await pool.query(`ALTER TABLE kayitlar ALTER COLUMN arac_id SET NOT NULL;`);
    await pool.query(`ALTER TABLE kayitlar ALTER COLUMN kullanici_id SET NOT NULL;`);
    await pool.query(`ALTER TABLE kayitlar ALTER COLUMN satis_miktari SET NOT NULL;`);
    await pool.query(`ALTER TABLE kayitlar ALTER COLUMN hakedis SET NOT NULL;`);
    await pool.query(`ALTER TABLE kayitlar ALTER COLUMN tarih SET NOT NULL;`);
    await pool.query(`ALTER TABLE kayitlar ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
    
    // Kayıtlar CHECK Kısıtlamaları
    await pool.query(`ALTER TABLE kayitlar DROP CONSTRAINT IF EXISTS kayitlar_satis_miktari_check;`);
    await pool.query(`ALTER TABLE kayitlar ADD CONSTRAINT kayitlar_satis_miktari_check CHECK (satis_miktari >= 0);`);
    await pool.query(`ALTER TABLE kayitlar DROP CONSTRAINT IF EXISTS kayitlar_hakedis_check;`);
    await pool.query(`ALTER TABLE kayitlar ADD CONSTRAINT kayitlar_hakedis_check CHECK (hakedis >= 0);`);

    // 3. İndeks Tanımları (Performans Optimizasyonu)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_firmalar_kullanici_id_aktif ON firmalar(kullanici_id, aktif);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_araclar_kullanici_id_aktif ON araclar(kullanici_id, aktif);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_kayitlar_kullanici_id_tarih ON kayitlar(kullanici_id, tarih);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_kayitlar_arac_id ON kayitlar(arac_id);`);

    // Null değer güncellemeleri
    await pool.query(`UPDATE firmalar SET aktif = TRUE WHERE aktif IS NULL;`);
    await pool.query(`UPDATE araclar SET aktif = TRUE WHERE aktif IS NULL;`);
}

module.exports = {
    pool,
    initDb
};