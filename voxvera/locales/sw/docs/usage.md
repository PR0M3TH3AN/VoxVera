# Maelezo ya Matumizi

Mwongozo huu unashughulikia taratibu za kawaida za CLI. Angalia `docs/docker.md` kwa maelekezo ya Docker na `docs/templates.md` kwa violezo vya vipeperushi vinavyopatikana.

## Mahitaji ya Awali

VoxVera imeundwa kuwa rahisi kubebeka na inahitaji vitegemezi vichache vya mfumo.

### 1. Programu Zinazojitegemea (Zinazopendekezwa)
Unaweza kupakua programu zinazojitegemea na zisizo na vitegemezi kwa mfumo wako wa uendeshaji:
- **Linux:** `voxvera-linux`
- **Windows:** `voxvera-windows.exe`
- **macOS:** `voxvera-macos`

Programu hizi zinajumuisha kila kitu kinachohitajika ili kuendesha VoxVera (isipokuwa `onionshare-cli`).

### 2. Kisakinishi cha Mstari Mmoja
Vinginevyo, sakinisha kupitia hati yetu ya kiotomatiki:

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### 3. Usakinishaji wa Mwongozo wa Python
Ikiwa unapendelea kuendesha kutoka kwenye chanzo:

```bash
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
sudo apt install tor onionshare-cli   # Debian/Ubuntu
```

## Hatua kwa Hatua

1. **Anzisha:** Endesha `voxvera init` na ufuate maelekezo. Utaulizwa kuchagua lugha yako kwanza.
2. **Jenga:** Tengeneza rasilimali za kipeperushi. Kila ujenzi huunda kiotomatiki faili ya `voxvera-portable.zip` kwenye folda ya kipeperushi, ikiruhusu wengine kupakua zana nzima moja kwa moja kutoka kwenye kipeperushi chako.
   ```bash
   voxvera build
   ```
3. **Tumia:** Chapisha kipeperushi kupitia Tor:
   ```bash
   voxvera serve
   ```
   Hii hutambua kiotomatiki mfumo wako wa Tor, inaanzisha OnionShare, na kuandika anwani ya .onion iliyozalishwa kwenye viungo vya kipeperushi.

## Usaidizi wa Lugha

VoxVera imetafsiriwa kikamilifu. Unaweza kubadilisha upendeleo wako wa lugha kwa kudumu ukitumia kiteuzi shirikishi au njia ya mkato ya moja kwa moja:

- **Kiteuzi Shirikishi:** `voxvera lang`
- **Njia ya Mkato ya Moja kwa Moja:** `voxvera --lang sw` (inaweka upendeleo kuwa Kiswahili)

### Lugha Zinazotumika:
- **Kiingereza:** `en`
- **Kihispania:** `es` (jina mbadala: `--idioma`)
- **Kijerumani:** `de` (jina mbadala: `--sprache`)
- **Kiswahili:** `sw`

Unaweza pia kulazimisha lugha maalum kwa amri moja bila kubadilisha upendeleo wako wa kudumu:
- **Kiingereza:** `voxvera --lang en check`
- **Kiswahili:** `voxvera --lang sw check`

Vipeperushi vilivyozalishwa hutambua kiotomatiki lugha ya kivinjari cha mgeni na kubadilisha maandishi ya UI ipasavyo.

## Usimamizi wa Seva

Simamia vipeperushi vingi na utambulisho wao wa Tor kutoka kwenye menyu moja shirikishi:

```bash
voxvera manage
```

Vipengele:
- **{{t('cli.manage_create_new')}}**: Anza mchakato mzima wa usanidi.
- **{{t('cli.manage_start_all')}}**: Anzisha au simamisha vipeperushi vyote kwenye kundi lako kwa mpigo mmoja.
- **Hali ya Wakati Halisi**: Angalia URL za .onion zinazofanya kazi na viashiria vya maendeleo ya kuanza kwa Tor.
- **Udhibiti wa Kibinafsi**: {{t('cli.manage_action_export')}} tovuti maalum kwenye ZIP au uzifute.

## Uakisi wa Ulimwengu (Usambazaji wa Virusi)

Ili kuhakikisha VoxVera inaendelea kupatikana hata kama hifadhi kuu zitadhibitiwa, kila kipeperushi hufanya kazi kama kioo cha zana hiyo.

Unapohifadhi kipeperushi, kitufe cha **"{{t('web.download_button')}}"** kwenye ukurasa wa kutua hutoa `voxvera-portable.zip` iliyo na:
- Chanzo kamili na lugha zote zinazotumika.
- Vitegemezi vyote vya Python (vilivyowekwa mapema).
- Programu za Tor za mifumo mbalimbali.

Hii inaruhusu kila mtu anayekagua kipeperushi chako kuwa msambazaji mpya wa zana ya VoxVera.

## Hamisha na Hifadhi Nakala

Hifadhi nakala za utambulisho wako wa kipekee wa Tor (ili URL yako ya .onion isibadilike kamwe) au hamisha vipeperushi vyako kwenye mashine nyingine.

- **Hamisha tovuti moja**: `voxvera export <jina_la_folda>`
- **Hamisha tovuti zote**: `voxvera export-all`

**Mahali pa kuhifadhi:** Hamisho zote zinahifadhiwa kwenye `~/voxvera-exports/` kwenye mifumo yote.

## Ingiza na Rejesha

Rejesha usanidi wako wote kwenye mashine mpya kwa kuhamisha faili zako za ZIP kwenda `~/voxvera-exports/` na uendeshe:

```bash
voxvera import-multiple
```

## Uwezo wa Kubebeka na Matumizi ya Nje ya Mtandao

Ikiwa unahitaji kuendesha VoxVera kwenye mashine isiyo na ufikiaji wa mtandao, unaweza kupakua vitegemezi kwanza:

```bash
voxvera vendorize
```

Hii inapakua maktaba zote za Python zinazohitajika kwenye `voxvera/vendor/`. Kisha zana itatoa kipaumbele kwa faili hizi za kienyeji, ikiruhusu iendeshe bila `pip install`.

## Ingiza kwa Wingi (JSON)

Ili kuzalisha vipeperushi kwa wingi kutoka kwa faili nyingi za usanidi wa JSON, ziweke kwenye folda ya `imports/` na uendeshe:

```bash
voxvera batch-import
```

## Jinsi URL Zinavyofanya Kazi

Kila kipeperushi kina URL mbili tofauti:
- **Kiungo cha kutolewa** (kinachozalishwa kiotomatiki): Anwani ya .onion ambapo kipeperushi kinahifadhiwa.
- **Kiungo cha maudhui** (kilichosanidiwa na mtumiaji): URL ya nje inayoelekeza kwenye tovuti, video, au upakuaji.

Huna haja ya kuingiza anwani ya .onion kwa mikono; VoxVera inashughulikia hili kiotomatiki wakati wa awamu ya `serve`.
