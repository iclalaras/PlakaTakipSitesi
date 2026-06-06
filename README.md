# 🚗 Plaka Takip Sistemi (License Plate Tracking System)

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2016.0.0-brightgreen.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-blue.svg)](https://www.postgresql.org/)
[![Express.js](https://img.shields.io/badge/framework-Express%20v5-lightgrey.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#)

Turizm ve taşımacılık sektöründe faaliyet gösteren şirketler için geliştirilmiş, anlaşmalı araçların günlük sefer girişlerini, satış cirolarını ve bunlara bağlı hak ediş (komisyon) ödemelerini uçtan uca takip eden modern ve responsive bir web platformudur.

---

## ✨ Öne Çıkan Özellikler

* **🔐 Çoklu Kullanıcı & Güvenli Oturum:** Kullanıcı bazlı izole edilmiş veri yönetimi. Her operatör yalnızca kendi oluşturduğu firmaları, plakaları ve satış kayıtlarını yönetir.
* **🏢 Firma & Plaka İlişkilendirmesi:** Tur firmaları ile bunlara bağlı araç plakalarının (örn. `34ABC123`) esnek yönetimi.
* **🛡️ Veri Bütünlüğü (Soft Delete):** Firma veya araç silme işlemlerinde geçmiş ciro analizlerinin bozulmaması için veriler fiziksel olarak silinmez, pasifleştirilir.
* **💸 Otomatik Hak Ediş Hesaplama:** Girilen satış tutarlarından **%25 oranında** hak ediş otomatik olarak hesaplanır ve sisteme kaydedilir.
* **📊 Gelişmiş Grafiksel Analiz:**
  * **Plaka Bazlı:** Belirli bir aracın gün/ay/yıl bazında satış ve hak ediş trendleri.
  * **Firma Bazlı:** Firmaların dönemsel toplam performans grafikleri.
  * **Tarih Aralıklı:** Pasta (Pie) grafiği ile **Firma Ciro Payları** ve Sütun (Bar) grafiği ile **Aylık Net Ciro Gelişimi**.

---

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji | Açıklama |
| :--- | :--- | :--- |
| **Backend** | Node.js / Express.js | Güçlü, asenkron ve modüler RESTful API sunucusu. |
| **Veritabanı** | PostgreSQL | Güvenilir ilişkisel veritabanı, veri bütünlüğü ve indeksleme. |
| **Frontend** | HTML5 / Vanilla CSS3 / JS | SPA mimarisi, sıfır kütüphane bağımlılığı (Vanilla CSS). |
| **Grafik** | Chart.js | İnteraktif ve responsive veri görselleştirme kütüphanesi. |

---

## 📂 Proje Yapısı

```text
plaka-takip-projesi/
├── README.md               # Genel Proje Tanımı ve Kurulum Kılavuzu
├── SRS.md                  # Yazılım Gereksinim Şartnamesi (SRS)
├── .gitignore              # Sürücü ve Bağımlılık Hariç Tutma Listesi
├── plaka-backend/          # API & Veritabanı Katmanı
│   ├── database.js         # PostgreSQL Bağlantı Havuzu & Şema Kurulumu
│   ├── server.js           # Express API Yönlendiricileri ve Auth Mantığı
│   └── package.json        # Proje Bağımlılıkları
└── plaka-frontend/         # İstemci (UI) Katmanı
    └── index.html          # Tek Sayfalık Arayüz & Görselleştirme (SPA)
```

---

## 💾 Veritabanı Şeması

```mermaid
erDiagram
    KULLANICILAR {
        int id PK
        string kullanici_adi UK
        string sifre
    }
    FIRMALAR {
        int id PK
        string firma_adi UK
        int kullanici_id FK
        boolean aktif
    }
    ARACLAR {
        int id PK
        string plaka UK
        int firma_id FK
        int kullanici_id FK
        boolean aktif
    }
    KAYITLAR {
        int id PK
        int arac_id FK
        int kullanici_id FK
        numeric satis_miktari
        numeric hakedis
        date tarih
    }

    KULLANICILAR ||--o{ FIRMALAR : "sahip"
    KULLANICILAR ||--o{ ARACLAR : "sahip"
    KULLANICILAR ||--o{ KAYITLAR : "sahip"
    FIRMALAR ||--o{ ARACLAR : "barindirir"
    ARACLAR ||--o{ KAYITLAR : "sahip"
```

---

## ⚙️ Kurulum ve Çalıştırma

### 1. Gereksinimler
* **Node.js** (v16+)
* **PostgreSQL** veritabanı sunucusu

### 2. Veritabanı Yapılandırması
PostgreSQL üzerinde `plaka` isimli bir veritabanı oluşturun:
```sql
CREATE DATABASE plaka;
```

### 3. Backend Sunucusunu Başlatma
`plaka-backend` dizinine gidin ve bağımlılıkları yükleyin:
```bash
cd plaka-backend
npm install
```

Ortam değişkenlerini yapılandırmak için `.env` dosyası oluşturun:
```env
PORT=3000
DATABASE_URL=postgresql://kullanici_adi:sifre@localhost:5432/plaka
```
*(Dosya oluşturulmazsa varsayılan olarak `postgresql://plaka_user:1234@localhost:5432/plaka` adresi kullanılır).*

Sunucuyu başlatın:
```bash
npm start
```

### 4. Frontend Arayüzüne Erişim
Arayüz statik olarak sunulmaktadır. Tarayıcınızdan doğrudan aşağıdaki adresi açabilirsiniz:
* **http://localhost:3000** (Yerel sunucu üzerinden)

---

## 📡 REST API Uç Noktaları

| Metot | Uç Nokta | Açıklama |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Yeni kullanıcı hesabı oluşturur. |
| `POST` | `/auth/login` | Giriş yapar ve kullanıcı detaylarını döner. |
| `GET` | `/firmalar` | Aktif firmaları listeler. |
| `POST` | `/firmalar` | Yeni firma kaydeder. |
| `POST` | `/firmalar/sil` | Firmayı ve bağlı plakaları pasife alır. |
| `GET` | `/araclar` | Aktif plakaları listeler. |
| `POST` | `/araclar` | Firmaya bağlı araç ekler. |
| `POST` | `/araclar/sil` | Plakayı pasife alır. |
| `POST` | `/kayitlar` | Günlük satış ve hakediş girişi yapar. |
| `GET` | `/kayitlar` | Tarih aralığına göre kayıtları listeler. |
| `GET` | `/rapor/plaka` | Plaka bazlı detaylı rapor ve grafik verisi sunar. |
| `GET` | `/rapor/firma` | Firma bazlı toplam ciro grafik verisi sunar. |
| `GET` | `/rapor/tarih` | İki tarih arası ciro, pasta grafik ve bar grafik verisi sunar. |
