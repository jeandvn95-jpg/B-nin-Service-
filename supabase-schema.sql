-- À exécuter une seule fois dans Supabase : Menu de gauche → SQL Editor → New query
-- Colle tout ce script, puis clique sur "Run".

create table if not exists kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Active la sécurité au niveau des lignes (obligatoire sur Supabase)
alter table kv_store enable row level security;

-- Le site utilise sa propre gestion des comptes (prestataires) côté application,
-- donc on autorise la clé publique (anon) à lire et écrire dans cette table.
-- ⚠️ Cela veut dire que la table est ouverte en lecture/écriture à quiconque
-- possède la clé publique du projet (ce qui est déjà le cas de n'importe quel
-- site utilisant Supabase côté client). C'est un point à améliorer plus tard
-- si le site prend de l'ampleur (ex. passer par des fonctions serveur).

create policy "Lecture publique" on kv_store
  for select using (true);

create policy "Écriture publique" on kv_store
  for insert with check (true);

create policy "Modification publique" on kv_store
  for update using (true);

create policy "Suppression publique" on kv_store
  for delete using (true);
