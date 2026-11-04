# VARMEKS QC — Kontrol Kartı

Üretim kalite kontrol uygulaması. Tek dosya (`index.html`), GitHub Pages'te yayınlanır; veriler Supabase'de saklanır.

## Kurulum
1. Supabase'de proje aç → **SQL Editor**'de `supabase-kurulum.sql` dosyasını çalıştır.
2. **Authentication → Sign In / Providers**: "Allow new users to sign up" kapalı olsun. Kullanıcıları **Authentication → Users → Add user** ile ekle (Auto Confirm işaretli).
3. **Project Settings → Data API** sayfasından Project URL, **API Keys → Legacy API keys** sekmesinden `anon` key (eyJ ile başlar)'i `index.html` içindeki `window.QC_CLOUD` satırına yaz.
4. GitHub → Settings → Pages → Branch: `main` / root.

## Notlar
- Her değişiklik birkaç saniyede buluta gider; internet yokken cihazda bekler.
- Her kartın değişmeden/silinmeden önceki hâli `qc_history` tablosunda durur.
- Supabase ücretsiz planda proje 1 hafta hiç kullanılmazsa duraklatılır; panelden tek tıkla açılır.
