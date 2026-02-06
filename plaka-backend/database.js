const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    console.error("Bağlantı adresi tanımlı değil.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDb() {
    //kullanıcıların id,kullanici_adi ve sifre değişkenlerini tutar
    await pool.query(`
        CREATE TABLE IF NOT EXISTS kullanicilar (
            id SERIAL PRIMARY KEY,
            kullanici_adi TEXT UNIQUE,
            sifre TEXT
        );
    `);
    //her firmaya id, unique firma_adi ve durum bilgisi taşıyan aktif değişkeni atar
    await pool.query(`
        CREATE TABLE IF NOT EXISTS firmalar (
            id SERIAL PRIMARY KEY,
            firma_adi TEXT UNIQUE,
            kullanici_id INTEGER REFERENCES kullanicilar(id),
            aktif BOOLEAN DEFAULT TRUE
        );
    `);
    //her araç için id,unique plaka ve aktif değişkeni atar. aracın ait olduğu firmayla FK ilişkisi kurar
    await pool.query(`
        CREATE TABLE IF NOT EXISTS araclar (
            id SERIAL PRIMARY KEY,
            plaka TEXT UNIQUE,
            firma_id INTEGER REFERENCES firmalar(id),
            kullanici_id INTEGER REFERENCES kullanicilar(id),
            aktif BOOLEAN DEFAULT TRUE
        );
    `);
    //hangi araç,hangi kullanıcı,ne kadar satış ve hak edişle tutulduğunu tutan kayitlar tablosu oluşturur.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS kayitlar (
            id SERIAL PRIMARY KEY,
            arac_id INTEGER REFERENCES araclar(id),
            kullanici_id INTEGER REFERENCES kullanicilar(id),
            satis_miktari NUMERIC,
            hakedis NUMERIC,
            tarih DATE DEFAULT CURRENT_DATE
        );
    `);
    //firmalar tablosuna, yoksa aktif adında (true/false) bir sütun ekler, varsayılanı true olur.
    await pool.query(`ALTER TABLE firmalar ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT TRUE;`);
    //araclar tablosuna da aynı şekilde aktif sütununu ekler.
    await pool.query(`ALTER TABLE araclar ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT TRUE;`);
    await pool.query(`ALTER TABLE firmalar ADD COLUMN IF NOT EXISTS kullanici_id INTEGER;`);
    await pool.query(`ALTER TABLE araclar ADD COLUMN IF NOT EXISTS kullanici_id INTEGER;`);

    //firmalar tablosunda aktif değeri boş olan tüm kayıtları true yapar.
    await pool.query(`UPDATE firmalar SET aktif = TRUE WHERE aktif IS NULL;`);
    //araclar tablosunda aktif değeri boş olan tüm kayıtları true yapar.
    await pool.query(`UPDATE araclar SET aktif = TRUE WHERE aktif IS NULL;`);
}

module.exports = {
    pool,
    initDb
};
