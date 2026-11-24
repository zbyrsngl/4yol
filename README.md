# Dört Diyar — Çağların Savaşı (v1.6)

Tarayıcıda, bilgisayarda ve telefonda oynanan, Age of Empires 2 tarzı bir gerçek zamanlı strateji oyunu.
Dört medeniyet (Bozkır Hanlığı, Kızıl Liman Cumhuriyeti, Taş Dağ Krallığı, Yeşil Orman Birliği), üç çağ,
yapay zekaya karşı tek oyunculu mod ve 4 kişiye kadar çok oyunculu mod.

## Oynamak
- **Tek oyunculu:** sayfayı aç, “Tek Oyunculu”ya bas.
- **Çok oyunculu:** “Çok Oyunculu → Yeni oyun kur” de, çıkan 4 harfli kodu arkadaşlarına gönder.
  Onlar aynı adresi açıp kodu yazarak katılır. Oyuncular birbirine doğrudan (WebRTC/PeerJS) bağlanır.
- Kayıtlar tarayıcıda saklanır (menü → Kaydet, ana menü → Kayıtlı oyunlar).

## 1.6 sürümünde yeni
- Alttaki bilgi paneli yarı yarıya küçültüldü; komut düğmeleri tek sıra halinde yana kayıyor (bilgisayarda fare tekerleğiyle de kaydırılır).

## 1.5 sürümünde yeni
- Her şey daha büyük: kamera artık daha yakından başlıyor (telefonda %130, bilgisayarda %140) ve %300'e kadar yakınlaştırılabiliyor. Menüdeki "Yakınlık" düğmesiyle de değiştirilebilir; seçtiğin yakınlık hatırlanır.

## 1.4 sürümünde yeni
- Dil seçeneği: Türkçe, English, Nederlands (ana menünün altında). İlk açılışta tarayıcının dili seçilir.
- Çeviriler `src/lang_en.js` ve `src/lang_nl.js` dosyalarında.

## 1.3 sürümünde yeni
- Haritada 👹 Ork kampları ve 🟢 Balçık gölleri: canavarlar yaklaşanlara saldırır, ganimet bırakır, kampı temizleyene hazine verir.
  Dev Balçık ölünce ikiye bölünür. Kurulumda “Canavar: Yok / Az / Çok”.
- Yeni karakter çizimleri: Kalkanlı Paralı, Gölge Okçu, Dağ Devi (takım renkli), ölüm animasyonları.
- GitHub sayfasında çalışan çok oyunculu bağlantı.

## Klasörler
- `index.html` — oyunun tamamı (tek dosya), `assets/` — resim atlasları.
- `src/` — kaynak kod. Değişiklikten sonra `python3 src/build.py` ile `index.html` yeniden oluşturulur.

## Emeği geçenler
- Karakter, bina, ağaç ve arazi grafikleri: **Tiny Swords** — Pixel Frog (pixelfrog-assets.itch.io)
- Kalkanlı Paralı ve Balçık: **Free Characters Animations Asset Pack** — OboroPixel
- Gölge Okçu, Dağ Devi ve Orklar: **Tiny RPG Character Asset Pack** — Zerie
- Grafikler kendi lisanslarına tabidir; bu depodaki resimler yalnızca oyunun içinde kullanılmak üzere düzenlenmiştir,
  ayrı olarak dağıtılamaz veya satılamaz.
