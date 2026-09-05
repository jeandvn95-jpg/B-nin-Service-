# Artisans+ — le carnet d'adresses des bons artisans

Ce dossier contient le code complet du site, prêt à être mis en ligne.

## 1. Créer la table dans Supabase (une seule fois)

1. Ouvre ton projet sur [supabase.com](https://supabase.com).
2. Dans le menu de gauche, clique sur **SQL Editor** puis **New query**.
3. Ouvre le fichier `supabase-schema.sql` de ce dossier, copie tout son contenu, colle-le dans l'éditeur SQL de Supabase.
4. Clique sur **Run**. Tu dois voir un message de succès.

C'est tout — la base de données est prête.

## 2. Mettre le code sur GitHub

1. Crée un compte sur [github.com](https://github.com) si tu n'en as pas.
2. Crée un nouveau dépôt (bouton vert "New").
3. Donne-lui un nom, par exemple `artisans-site`. Laisse-le "Public" ou "Private", peu importe.
4. Sur la page du nouveau dépôt, utilise le bouton **"uploading an existing file"** (ou "Add file → Upload files") pour envoyer tous les fichiers de ce dossier — **sauf le fichier `.env`** (il ne doit jamais être mis en ligne publiquement, il contient tes identifiants).
5. Valide l'envoi ("Commit changes").

## 3. Déployer sur Vercel (gratuit)

1. Va sur [vercel.com](https://vercel.com) et connecte-toi avec ton compte GitHub.
2. Clique sur **"Add New" → "Project"**.
3. Choisis le dépôt `artisans-site` que tu viens de créer.
4. Avant de cliquer sur "Deploy", ouvre la section **"Environment Variables"** et ajoute ces deux lignes (les mêmes valeurs que dans ton fichier `.env`) :
   - `VITE_SUPABASE_URL` → `https://mccsbbdvmfqrdqrznxkc.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → `sb_publishable_qwSJgGAILcEdMPAXFAMjPA_wgGRD1n4`
5. Clique sur **Deploy**. Après 1 à 2 minutes, Vercel te donne une adresse du type `artisans-site.vercel.app` — ton site est en ligne !

## 4. (Optionnel) Nom de domaine personnalisé

Dans les réglages du projet Vercel → **Domains**, tu peux ajouter un nom de domaine que tu as acheté ailleurs (Namecheap, etc.) et suivre les instructions pour le connecter.

## Code d'accès à l'espace validation

Le code actuel est `admin2026`, en dur dans `src/App.jsx` (recherche `admin2026` dans le fichier). Pense à le changer pour quelque chose de moins devinable avant l'ouverture publique.

## Tester en local avant de déployer (optionnel)

Si tu as Node.js installé sur ton ordinateur :

```
npm install
npm run dev
```

Le site sera visible sur `http://localhost:5173`.
