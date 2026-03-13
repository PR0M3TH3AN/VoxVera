# Detaylı Kullanım

Bu kılavuz, yaygın CLI iş akışlarını kapsar. Docker talimatları için `docs/docker.md` ve mevcut ilan şablonları için `docs/templates.md` dosyalarına bakın.

## Ön Koşullar

VoxVera, yüksek taşınabilirlik için tasarlanmıştır ve minimum sistem bağımlılığı gerektirir.

### 1. Bağımsız İkililer (Önerilen)
İşletim sisteminiz için bağımsız, bağımlılık gerektirmeyen ikili dosyaları (binaries) indirebilirsiniz:
- **Linux:** `voxvera-linux`
- **Windows:** `voxvera-windows.exe`
- **macOS:** `voxvera-macos`

Bu dosyalar, VoxVera'yı çalıştırmak için gereken her şeyi içerir (`onionshare-cli` hariç).

### 2. Tek Satırlık Kurulum
Alternatif olarak, otomatik betiğimiz aracılığıyla kurulum yapın:

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### 3. Manuel Python Kurulumu
Kaynaktan çalıştırmayı tercih ederseniz:

```bash
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
sudo apt install tor onionshare-cli   # Debian/Ubuntu
```

## Adım Adım

1. **Başlatma:** `voxvera init` komutunu çalıştırın ve istemleri takip edin. Önce dilinizi seçmeniz istenecektir.
2. **Oluşturma:** İlan varlıklarını oluşturun. Her oluşturma işlemi, ilan klasöründe otomatik olarak bir `voxvera-portable.zip` oluşturur; bu sayede başkaları tam aracı doğrudan ilanınızdan indirebilir.
   ```bash
   voxvera build
   ```
3. **Sunma:** İlanı Tor üzerinden yayınlayın:
   ```bash
   voxvera serve
   ```
   bu komut mevcut Tor örneğinizi otomatik olarak algılar, OnionShare'i başlatır ve oluşturulan .onion adresini ilandaki yırtılabilir bağlantılara yazar.

## Dil Desteği

VoxVera tamamen yerelleştirilmiştir. Dil tercihinizi etkileşimli seçiciyi veya doğrudan kısayolu kullanarak kalıcı olarak değiştirebilirsiniz:

- **Etkileşimli Seçici:** `voxvera lang`
- **Doğrudan Kısayol:** `voxvera --lang tr` (tercihi Türkçe olarak ayarlar)

### Desteklenen Diller:
- **İngilizce:** `en`
- **İspanyolca:** `es` (takma ad: `--idioma`)
- **Almanca:** `de` (takma ad: `--sprache`)
- **Türkçe:** `tr`

Kalıcı tercihinizi değiştirmeden tek bir komut için belirli bir dili de zorlayabilirsiniz:
- **İngilizce:** `voxvera --lang en check`
- **Türkçe:** `voxvera --lang tr check`

Oluşturulan ilanlar, ziyaretçinin tarayıcı dilini otomatik olarak algılar ve kullanıcı arayüzü metnini buna göre değiştirir.

## Sunucu Yönetimi

Tek bir etkileşimli menüden birden fazla ilanı ve Tor kimliklerini yönetin:

```bash
voxvera manage
```

Özellikler:
- **--- Yeni Site/İlan Oluştur ---**: Tam kurulum dizisini başlatın.
- **--- Tüm Siteleri Başlat ---**: Filonuzdaki tüm ilanları tek seferde başlatın veya kapatın.
- **Gerçek Zamanlı Durum**: Aktif .onion URL'lerini ve Tor başlatma ilerleme göstergelerini görüntüleyin.
- **Bireysel Kontrol**: Belirli siteleri ZIP olarak Zip Olarak Dışa Aktar veya silin.

## Evrensel Aynalama (Viral Dağıtım)

Merkezi depolar sansürlense bile VoxVera'nın erişilebilir kalmasını sağlamak için her ilan, araç için bir ayna görevi görür.

Bir ilanı barındırdığınızda, açılış sayfasındaki **"Aracı ve Kaynak Kodunu İndir"** düğmesi şunları içeren bir `voxvera-portable.zip` sunar:
- Tam kaynak kodu ve desteklenen tüm diller.
- Tüm Python bağımlılıkları (önceden paketlenmiş).
- Platformlar arası Tor ikilileri.

Bu, ilanınızı tarayan herkesin VoxVera aracının yeni bir dağıtıcısı olmasını sağlar.

## Dışa Aktarma ve Yedekleme

Benzersiz Tor kimliklerinizi yedekleyin (.onion URL'nizin hiç değişmemesi için) veya ilanlarınızı başka bir makineye taşıyın.

- **Tek bir siteyi dışa aktar**: `voxvera export <klasör_adı>`
- **Tüm siteleri dışa aktar**: `voxvera export-all`

**Depolama konumu:** Tüm dışa aktarmalar, tüm platformlarda kullanıcının ana dizinindeki `~/voxvera-exports/` klasörüne ZIP dosyası olarak kaydedilir.

## İçe Aktarma ve Kurtarma

ZIP dosyalarınızı `~/voxvera-exports/` dizinine taşıyıp şu komutu çalıştırarak tüm kurulumunuzu yeni bir makinede geri yükleyin:

```bash
voxvera import-multiple
```

## Taşınabilirlik ve Çevrimdışı Kullanım

VoxVera'yı internet erişimi olmayan bir makinede çalıştırmanız gerekirse, önce bağımlılıkları yerelleştirebilirsiniz:

```bash
voxvera vendorize
```

Bu, gerekli tüm Python kütüphanelerini `voxvera/vendor/` dizinine indirir. Araç daha sonra bu yerel dosyalara öncelik vererek `pip install` olmadan çalışmasına olanak tanır.

## Toplu İçe Aktarma (JSON)

Birden fazla JSON yapılandırma dosyasından toplu ilan oluşturmak için bunları `imports/` dizinine yerleştirin ve çalıştırın:

```bash
voxvera batch-import
```

## URL'ler Nasıl Çalışır?

Her ilanın iki ayrı URL'si vardır:
- **Yırtılabilir bağlantı** (otomatik oluşturulur): İlanın barındırıldığı .onion adresi.
- **İçerik bağlantısı** (kullanıcı tarafından yapılandırılır): Bir web sitesine, videoya veya indirmeye işaret eden harici bir URL.

.onion adresini manuel olarak girmenize gerek yoktur; VoxVera `serve` aşamasında bunu otomatik olarak halleder.
