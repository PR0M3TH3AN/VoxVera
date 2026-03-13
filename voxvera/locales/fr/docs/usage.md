# Utilisation détaillée

Ce guide couvre les flux de travail CLI courants. Consultez `docs/docker.md` pour les instructions Docker et `docs/templates.md` pour les modèles de flyers disponibles.

## Prérequis

VoxVera est conçu pour être hautement portable et nécessite un minimum de dépendances système.

### 1. Binaires autonomes (Recommandé)
Vous pouvez télécharger des binaires autonomes sans dépendance pour votre système d'exploitation :
- **Linux :** `voxvera-linux`
- **Windows :** `voxvera-windows.exe`
- **macOS :** `voxvera-macos`

Ces binaires incluent tout le nécessaire pour exécuter VoxVera (sauf `onionshare-cli`).

### 2. Installateur en une ligne
Alternativement, installez via notre script automatisé :

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### 3. Installation Python manuelle
Si vous préférez exécuter à partir des sources :

```bash
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
sudo apt install tor onionshare-cli   # Debian/Ubuntu
```

## Étape par étape

1. **Initialiser :** Exécutez `voxvera init` et suivez les instructions. Il vous sera demandé de choisir votre langue en premier.
2. **Construire :** Générez les fichiers du flyer. Chaque construction crée automatiquement un `voxvera-portable.zip` dans le dossier du flyer, permettant aux autres de télécharger l'outil complet directement depuis votre flyer.
   ```bash
   voxvera build
   ```
3. **Servir :** Publiez le flyer sur Tor :
   ```bash
   voxvera serve
   ```
   Ceci détecte automatiquement votre instance Tor, démarre OnionShare et écrit l'adresse .onion générée dans les liens détachables du flyer.

## Support linguistique

VoxVera est entièrement localisé. Vous pouvez changer votre préférence linguistique de manière permanente en utilisant soit le sélecteur interactif, soit un raccourci direct :

- **Sélecteur interactif :** `voxvera lang`
- **Raccourci direct :** `voxvera --lang fr` (définit la préférence sur le français)

### Langues supportées :
- **Anglais :** `en`
- **Espagnol :** `es` (alias : `--idioma`)
- **Allemand :** `de` (alias : `--sprache`)
- **Français :** `fr`

Vous pouvez également forcer une langue spécifique pour une seule commande sans changer votre préférence permanente :
- **Anglais :** `voxvera --lang en check`
- **Français :** `voxvera --lang fr check`

Les flyers générés détectent automatiquement la langue du navigateur du visiteur et adaptent le texte de l'interface en conséquence.

## Gestion des serveurs

Gérez plusieurs flyers et leurs identités Tor à partir d'un seul menu interactif :

```bash
voxvera manage
```

Fonctionnalités :
- **{{t('cli.manage_create_new')}}** : Démarre la séquence de configuration complète.
- **{{t('cli.manage_start_all')}}** : Lance ou arrête tous les flyers de votre flotte en une seule fois.
- **Statut en temps réel** : Visualisez les URL .onion actives et les indicateurs de progression de l'amorçage Tor.
- **Contrôle individuel** : {{t('cli.manage_action_export')}} des sites spécifiques vers ZIP ou supprimez-les.

## Mise en miroir universelle (Distribution virale)

Pour garantir que VoxVera reste accessible même si les dépôts centraux sont censurés, chaque flyer agit comme un miroir pour l'outil.

Lorsque vous hébergez un flyer, le bouton **"{{t('web.download_button')}}"** sur la page d'accueil fournit un `voxvera-portable.zip` contenant :
- Le code source complet et toutes les langues supportées.
- Toutes les dépendances Python (pré-vendues).
- Les binaires Tor multiplateformes.

Cela permet à quiconque scanne votre flyer de devenir un nouveau distributeur de l'outil VoxVera.

## Exportation & Sauvegarde

Sauvegardez vos identités Tor uniques (pour que votre URL .onion ne change jamais) ou déplacez vos flyers vers une autre machine.

- **Exporter un seul site** : `voxvera export <nom_du_dossier>`
- **Exporter tous les sites** : `voxvera export-all`

**Lieu de stockage :** Toutes les exportations sont sauvegardées dans `~/voxvera-exports/` sur toutes les plateformes.

## Importation & Récupération

Restaurez toute votre configuration sur une nouvelle machine en déplaçant vos fichiers ZIP vers `~/voxvera-exports/` et en exécutant :

```bash
voxvera import-multiple
```

## Portabilité & Utilisation hors ligne

Si vous devez exécuter VoxVera sur une machine sans accès à Internet, vous pouvez d'abord "vendeuriser" les dépendances :

```bash
voxvera vendorize
```

Ceci télécharge toutes les bibliothèques Python requises dans `voxvera/vendor/`. L'outil donnera alors la priorité à ces fichiers locaux, lui permettant de s'exécuter sans `pip install`.

## Importation par lot (JSON)

Pour générer en masse des flyers à partir de plusieurs fichiers de configuration JSON, placez-les dans le répertoire `imports/` et exécutez :

```bash
voxvera batch-import
```

## Comment fonctionnent les URL

Chaque flyer possède deux URL distinctes :
- **Lien détachable** (auto-généré) : L'adresse .onion où le flyer est hébergé.
- **Lien de contenu** (configuré par l'utilisateur) : Une URL externe pointant vers un site web, une vidéo ou un téléchargement.

Vous n'avez pas besoin de saisir manuellement l'adresse .onion ; VoxVera s'en occupe automatiquement pendant la phase `serve`.
