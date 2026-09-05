import { useState, useEffect, useCallback } from "react";
import { storage } from "./storage";
import { Wrench, Zap, ShoppingBag, Search, Plus, Phone, MessageCircle, ShieldCheck, Clock, X, Check, ChevronLeft, Stamp, User, LogOut, Lightbulb, Sparkles, Rocket, Camera } from "lucide-react";

// ---------- Design tokens ----------
// Palette: atelier / carnet d'ouvrier — bleu nuit (fond nav), papier kraft clair (fond page),
// ambre "sécurité électrique" comme accent, vert tampon pour validation.
const C = {
  ink: "#1C2530",       // bleu-nuit profond
  paper: "#F1ECE1",     // kraft clair
  paperDeep: "#E4DCC9",
  amber: "#D98E2B",     // accent ambre / avertissement électrique
  amberDeep: "#B5701C",
  stamp: "#3F6E4E",     // vert tampon "vérifié"
  rust: "#A8412E",      // rouge rouille / refus
  line: "#C9BFA8",
};

const ICONS = { zap: Zap, wrench: Wrench, bag: ShoppingBag };
const iconFor = (key) => ICONS[key] || Wrench;

const DEFAULT_CATEGORIES = [
  { id: "electricite", label: "Électricité", icon: "zap" },
  { id: "plomberie", label: "Plomberie", icon: "wrench" },
  { id: "vente", label: "Vente", icon: "bag" },
  { id: "autre", label: "Autre service", icon: "wrench" },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || uid();

// ---------- Paiement mise en avant (Mobile Money) ----------
const MOMO_NUMBER = "01 91 49 52 49";
const BOOST_OFFERS = [
  { days: 7, amount: 3000 },
  { days: 30, amount: 10000 },
];
const fcfa = (n) => `${n.toLocaleString("fr-FR")} FCFA`;
const dayMs = 24 * 60 * 60 * 1000;
const isBoostActive = (u) => !!u.boosted && (!u.boostExpiresAt || u.boostExpiresAt > Date.now());
const daysLeft = (u) => u.boostExpiresAt ? Math.max(0, Math.ceil((u.boostExpiresAt - Date.now()) / dayMs)) : null;

// Hachage simple côté client (meilleur que du texte en clair, mais pas un niveau de sécurité "production" —
// un vrai site aurait besoin d'un hachage côté serveur type bcrypt).
function simpleHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

// Redimensionne et compresse une photo pour rester compact en base64 (stockage texte).
function fileToCompressedDataUrl(file, maxSize = 480, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image invalide"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function useLocalUser() {
  const [me, setMe] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get("session");
        if (r?.value) setMe(JSON.parse(r.value));
      } catch (e) {}
    })();
  }, []);
  const save = async (u) => {
    setMe(u);
    try {
      await storage.set("session", JSON.stringify(u));
    } catch (e) {}
  };
  const clear = async () => {
    setMe(null);
    try {
      await storage.delete("session");
    } catch (e) {}
  };
  return [me, save, clear];
}

export default function App() {
  const [view, setView] = useState({ name: "home" });
  const [me, setMe, clearMe] = useLocalUser();
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [suggestions, setSuggestions] = useState([]);
  const [reports, setReports] = useState([]);
  const [boostHistory, setBoostHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const loadUsers = useCallback(async () => {
    try {
      const idx = await storage.get("user-index", true);
      const ids = idx?.value ? JSON.parse(idx.value) : [];
      const list = [];
      for (const id of ids) {
        try {
          const r = await storage.get(`user:${id}`, true);
          if (r?.value) list.push(JSON.parse(r.value));
        } catch (e) {}
      }
      setUsers(list);
    } catch (e) {
      setUsers([]);
    }
    setLoading(false);
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const r = await storage.get("categories", true);
      if (r?.value) {
        setCategories(JSON.parse(r.value));
      } else {
        await storage.set("categories", JSON.stringify(DEFAULT_CATEGORIES), true);
        setCategories(DEFAULT_CATEGORIES);
      }
    } catch (e) {
      setCategories(DEFAULT_CATEGORIES);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const idx = await storage.get("suggestion-index", true);
      const ids = idx?.value ? JSON.parse(idx.value) : [];
      const list = [];
      for (const id of ids) {
        try {
          const r = await storage.get(`suggestion:${id}`, true);
          if (r?.value) list.push(JSON.parse(r.value));
        } catch (e) {}
      }
      setSuggestions(list);
    } catch (e) {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadCategories();
    loadSuggestions();
    loadReports();
    loadBoostHistory();
  }, [loadUsers, loadCategories, loadSuggestions]);

  const loadReports = useCallback(async () => {
    try {
      const idx = await storage.get("report-index", true);
      const ids = idx?.value ? JSON.parse(idx.value) : [];
      const list = [];
      for (const id of ids) {
        try {
          const r = await storage.get(`report:${id}`, true);
          if (r?.value) list.push(JSON.parse(r.value));
        } catch (e) {}
      }
      setReports(list);
    } catch (e) {
      setReports([]);
    }
  }, []);

  const addReport = async (userId, userName, reason) => {
    const r = { id: uid(), userId, userName, reason, from: me?.name || "Visiteur", createdAt: Date.now(), status: "new" };
    const idxR = await storage.get("report-index", true).catch(() => null);
    const ids = idxR?.value ? JSON.parse(idxR.value) : [];
    await storage.set("report-index", JSON.stringify([...ids, r.id]), true);
    await storage.set(`report:${r.id}`, JSON.stringify(r), true);
    await loadReports();
  };

  const updateReport = async (r) => {
    await storage.set(`report:${r.id}`, JSON.stringify(r), true);
    await loadReports();
  };

  const loadBoostHistory = useCallback(async () => {
    try {
      const r = await storage.get("boost-history", true);
      setBoostHistory(r?.value ? JSON.parse(r.value) : []);
    } catch (e) {
      setBoostHistory([]);
    }
  }, []);

  const logBoostHistory = async (entry) => {
    const r = await storage.get("boost-history", true).catch(() => null);
    const list = r?.value ? JSON.parse(r.value) : [];
    const next = [...list, entry];
    await storage.set("boost-history", JSON.stringify(next), true);
    setBoostHistory(next);
  };

  const addCategory = async ({ label, icon }) => {
    const cat = { id: `${slugify(label)}-${uid().slice(0, 4)}`, label, icon: icon || "wrench" };
    const next = [...categories, cat];
    await storage.set("categories", JSON.stringify(next), true);
    setCategories(next);
    return cat;
  };

  const renameCategory = async (id, label) => {
    const next = categories.map((c) => (c.id === id ? { ...c, label } : c));
    await storage.set("categories", JSON.stringify(next), true);
    setCategories(next);
  };

  const deleteCategory = async (id) => {
    const next = categories.filter((c) => c.id !== id);
    await storage.set("categories", JSON.stringify(next), true);
    setCategories(next);
  };

  const addSuggestion = async (text) => {
    const s = { id: uid(), text, from: me?.name || "Visiteur", createdAt: Date.now(), status: "new" };
    const idxR = await storage.get("suggestion-index", true).catch(() => null);
    const ids = idxR?.value ? JSON.parse(idxR.value) : [];
    await storage.set("suggestion-index", JSON.stringify([...ids, s.id]), true);
    await storage.set(`suggestion:${s.id}`, JSON.stringify(s), true);
    await loadSuggestions();
  };

  const updateSuggestion = async (s) => {
    await storage.set(`suggestion:${s.id}`, JSON.stringify(s), true);
    await loadSuggestions();
  };

  const addUser = async (u) => {
    const idxR = await storage.get("user-index", true).catch(() => null);
    const ids = idxR?.value ? JSON.parse(idxR.value) : [];
    const nextIds = [...ids, u.id];
    await storage.set("user-index", JSON.stringify(nextIds), true);
    await storage.set(`user:${u.id}`, JSON.stringify(u), true);
    await loadUsers();
  };

  const updateUser = async (u) => {
    await storage.set(`user:${u.id}`, JSON.stringify(u), true);
    await loadUsers();
    if (me?.id === u.id) setMe(u);
  };

  const toggleBoost = async (u) => {
    // Bascule manuelle par l'admin (gratuite, sans expiration) — utile pour un geste commercial.
    const next = u.boosted
      ? { ...u, boosted: false, boostedAt: null, boostExpiresAt: null }
      : { ...u, boosted: true, boostedAt: Date.now(), boostExpiresAt: null, boostRequest: null };
    await updateUser(next);
  };

  const requestBoost = async (u, days) => {
    const offer = BOOST_OFFERS.find((o) => o.days === days);
    if (!offer) return;
    const reference = `BST-${u.id.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-5)}`;
    await updateUser({
      ...u,
      boostRequest: { days: offer.days, amount: offer.amount, reference, requestedAt: Date.now() },
    });
    return reference;
  };

  const cancelBoostRequest = async (u) => {
    await updateUser({ ...u, boostRequest: null });
  };

  const confirmBoost = async (u) => {
    if (!u.boostRequest) return;
    const expiresAt = Date.now() + u.boostRequest.days * dayMs;
    await logBoostHistory({ userId: u.id, userName: u.name, days: u.boostRequest.days, amount: u.boostRequest.amount, reference: u.boostRequest.reference, confirmedAt: Date.now() });
    await updateUser({ ...u, boosted: true, boostedAt: Date.now(), boostExpiresAt: expiresAt, boostRequest: null });
  };

  const rejectBoostRequest = async (u) => {
    await updateUser({ ...u, boostRequest: null });
  };

  const updateRating = async (u, avgRating, ratingCount) => {
    await updateUser({ ...u, avgRating, ratingCount });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.paper, fontFamily: "'Georgia', serif", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin:0; }
        .disp { font-family:'Archivo Black', sans-serif; letter-spacing:-0.01em; }
        .sans { font-family:'Archivo', sans-serif; }
        .btn { cursor:pointer; border:none; font-family:'Archivo',sans-serif; font-weight:700; transition:transform .12s ease, box-shadow .12s ease; }
        .btn:active { transform: translateY(1px); }
        .card { background:#fff; border:1px solid ${C.line}; }
        input, select, textarea { font-family:'Archivo',sans-serif; }
        ::selection { background:${C.amber}; color:#fff; }
      `}</style>

      {toast && (
        <div className="sans" style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: C.ink, color: "#fff", padding: "10px 18px", borderRadius: 3, zIndex: 100, fontSize: 14, fontWeight: 600, boxShadow: "0 6px 20px rgba(0,0,0,.25)" }}>
          {toast}
        </div>
      )}

      <Header me={me} onLogout={async () => { await clearMe(); setView({ name: "home" }); flash("Déconnecté"); }} onNav={setView} />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "0 20px 80px" }}>
        {view.name === "home" && <Home users={users} categories={categories} loading={loading} onNav={setView} onSuggest={async (text) => { await addSuggestion(text); flash("Merci ! Votre suggestion a été transmise."); }} />}
        {view.name === "category" && <CategoryList category={view.category} users={users} categories={categories} onNav={setView} />}
        {view.name === "profile" && (
          <Profile
            user={users.find((u) => u.id === view.id)}
            me={me}
            categories={categories}
            onNav={setView}
            flash={flash}
            onRequestBoost={requestBoost}
            onCancelBoostRequest={cancelBoostRequest}
            onUpdateUser={updateUser}
            onUpdateRating={updateRating}
            onReport={async (userId, userName, reason) => { await addReport(userId, userName, reason); flash("Signalement envoyé — merci."); }}
          />
        )}
        {view.name === "signup" && <Signup me={me} categories={categories} onCreated={async (u) => { await addUser(u); await setMe(u); flash("Profil créé — en attente de validation."); setView({ name: "profile", id: u.id }); }} onNav={setView} />}
        {view.name === "login" && <Login users={users} onLogin={async (u) => { await setMe(u); flash(`Bon retour, ${u.name}`); setView({ name: "profile", id: u.id }); }} onNav={setView} />}
        {view.name === "admin" && (
          <Admin
            users={users}
            categories={categories}
            suggestions={suggestions}
            reports={reports}
            boostHistory={boostHistory}
            onDecision={async (u, status) => { await updateUser({ ...u, status }); flash(status === "approved" ? "Profil validé" : "Profil refusé"); }}
            onAddCategory={async (c) => { await addCategory(c); flash("Catégorie ajoutée."); }}
            onRenameCategory={async (id, label) => { await renameCategory(id, label); flash("Catégorie renommée."); }}
            onDeleteCategory={async (id) => { await deleteCategory(id); flash("Catégorie supprimée."); }}
            onSuggestionUpdate={async (s) => { await updateSuggestion(s); }}
            onToggleBoost={toggleBoost}
            onConfirmBoost={async (u) => { await confirmBoost(u); flash("Mise en avant activée."); }}
            onRejectBoostRequest={async (u) => { await rejectBoostRequest(u); flash("Demande refusée."); }}
            onReportUpdate={async (r) => { await updateReport(r); }}
            onNav={setView}
          />
        )}
        {view.name === "legal" && <Legal onNav={setView} />}
      </main>

      <Footer onNav={setView} />
    </div>
  );
}

function Header({ me, onLogout, onNav }) {
  return (
    <header style={{ background: C.ink, color: C.paper }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onNav({ name: "home" })}>
          <div style={{ width: 34, height: 34, background: C.amber, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3 }}>
            <Wrench size={18} color={C.ink} />
          </div>
          <span className="disp" style={{ fontSize: 20 }}>ARTISANS&nbsp;+</span>
        </div>
        <nav className="sans" style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 14 }}>
          {me ? (
            <>
              <span style={{ opacity: 0.8 }}>Bonjour, {me.name.split(" ")[0]}</span>
              <button className="btn" onClick={() => onNav({ name: "profile", id: me.id })} style={{ background: "transparent", color: C.paper, textDecoration: "underline", padding: 0 }}>Mon profil</button>
              <button className="btn" onClick={onLogout} style={{ background: "transparent", color: C.paper, display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
                <LogOut size={15} /> Quitter
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => onNav({ name: "login" })} style={{ background: "transparent", color: C.paper, padding: 0 }}>Connexion</button>
              <button className="btn" onClick={() => onNav({ name: "signup" })} style={{ background: C.amber, color: "#fff", padding: "9px 16px", borderRadius: 3 }}>
                Proposer un service
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer({ onNav }) {
  return (
    <footer className="sans" style={{ borderTop: `1px solid ${C.line}`, marginTop: 60, padding: "22px 20px", textAlign: "center", fontSize: 12, color: "#8a8272" }}>
      <span>Répertoire local de prestataires — profils vérifiés avant publication.</span>
      <span style={{ margin: "0 10px" }}>·</span>
      <button className="btn" onClick={() => onNav({ name: "admin" })} style={{ background: "transparent", color: "#8a8272", textDecoration: "underline", padding: 0, fontSize: 12 }}>
        Espace validation
      </button>
      <span style={{ margin: "0 10px" }}>·</span>
      <button className="btn" onClick={() => onNav({ name: "legal" })} style={{ background: "transparent", color: "#8a8272", textDecoration: "underline", padding: 0, fontSize: 12 }}>
        Mentions légales
      </button>
    </footer>
  );
}

function Legal({ onNav }) {
  return (
    <section style={{ padding: "30px 0", maxWidth: 640 }}>
      <BackBtn onNav={onNav} label="Retour" />
      <h2 className="disp" style={{ fontSize: 26, margin: "14px 0 18px" }}>Mentions légales</h2>
      <div className="sans" style={{ fontSize: 14, lineHeight: 1.8, color: "#3a352a" }}>
        <p><b>À personnaliser avant mise en ligne.</b> Ce texte est un modèle de départ — remplace les crochets par tes informations réelles (éditeur du site, contact, hébergeur) avant publication.</p>
        <p><b>Éditeur du site :</b> [Ton nom ou celui de ton entreprise] — [ville, pays] — contact : [téléphone / email].</p>
        <p><b>Objet du site :</b> mise en relation entre particuliers/entreprises et prestataires de services locaux. Le site ne réalise pas lui-même les prestations et n'est pas responsable de la qualité des services rendus par les prestataires référencés.</p>
        <p><b>Validation des profils :</b> chaque profil est vérifié manuellement avant publication, mais cette vérification ne constitue pas une garantie contractuelle sur la qualité du travail du prestataire.</p>
        <p><b>Mise en avant payante :</b> les prestataires peuvent payer une mise en avant temporaire de leur annonce par Mobile Money. Ce paiement concerne uniquement la visibilité de l'annonce, pas une certification de qualité.</p>
        <p><b>Données personnelles :</b> les informations fournies (nom, téléphone, ville, photo) sont utilisées uniquement pour le fonctionnement du site et sa mise en relation. [Préciser ici la durée de conservation et comment demander la suppression de son profil.]</p>
        <p><b>Signalement :</b> tout profil ou comportement abusif peut être signalé via le bouton "Signaler ce profil" présent sur chaque fiche.</p>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section style={{ padding: "56px 0 34px", borderBottom: `2px solid ${C.ink}` }}>
      <div className="sans" style={{ fontSize: 13, fontWeight: 700, color: C.amberDeep, letterSpacing: "0.08em", marginBottom: 10 }}>
        LE CARNET D'ADRESSES DES BONS ARTISANS
      </div>
      <h1 className="disp" style={{ fontSize: "clamp(32px,6vw,52px)", lineHeight: 1.02, margin: "0 0 14px" }}>
        Trouvez un électricien, <br /> un plombier, un vendeur —<br /> vérifié, pas au hasard.
      </h1>
      <p className="sans" style={{ maxWidth: 520, fontSize: 15, color: "#4a4438", lineHeight: 1.6 }}>
        Chaque prestataire passe une validation avant publication. Contactez-le directement par téléphone, WhatsApp ou message.
      </p>
    </section>
  );
}

function sortListings(list) {
  return [...list].sort((a, b) => {
    const ab = isBoostActive(a), bb = isBoostActive(b);
    if (bb !== ab) return (bb ? 1 : 0) - (ab ? 1 : 0);
    if (ab && bb) return (b.boostedAt || 0) - (a.boostedAt || 0);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function Home({ users, categories, loading, onNav, onSuggest }) {
  const [q, setQ] = useState("");
  const approved = sortListings(users.filter((u) => u.status === "approved"));
  const query = q.trim().toLowerCase();
  const results = query
    ? approved.filter((u) => u.name?.toLowerCase().includes(query) || u.city?.toLowerCase().includes(query) || u.description?.toLowerCase().includes(query))
    : approved.slice(0, 6);

  return (
    <div>
      <Hero />

      <section style={{ padding: "10px 0 0" }}>
        <div className="sans" style={{ position: "relative" }}>
          <Search size={16} color="#8a8272" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par ville ou par nom…"
            style={{ ...inputStyle, width: "100%", padding: "13px 14px 13px 40px", fontSize: 14 }}
          />
        </div>
      </section>

      <section style={{ padding: "36px 0 10px" }}>
        <div className="sans" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "#8a8272", marginBottom: 14 }}>
          CATÉGORIES
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12 }}>
          {categories.map((c) => {
            const Icon = iconFor(c.icon);
            const count = approved.filter((u) => u.category === c.id).length;
            return (
              <button key={c.id} className="btn card" onClick={() => onNav({ name: "category", category: c.id })}
                style={{ padding: "20px 16px", textAlign: "left", borderRadius: 4 }}>
                <Icon size={22} color={C.amberDeep} />
                <div className="disp" style={{ fontSize: 16, marginTop: 10 }}>{c.label}</div>
                <div className="sans" style={{ fontSize: 12, color: "#8a8272", marginTop: 4 }}>{count} prestataire{count !== 1 ? "s" : ""}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ padding: "40px 0" }}>
        <div className="sans" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "#8a8272", marginBottom: 14 }}>
          {query ? `RÉSULTATS POUR « ${q.trim()} »` : "RÉCEMMENT VALIDÉS"}
        </div>
        {loading ? (
          <p className="sans" style={{ color: "#8a8272" }}>Chargement…</p>
        ) : results.length === 0 ? (
          query ? <p className="sans" style={{ color: "#8a8272" }}>Aucun résultat pour cette recherche.</p> : <EmptyState onNav={onNav} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 14 }}>
            {results.map((u) => (
              <UserCard key={u.id} u={u} categories={categories} onNav={onNav} />
            ))}
          </div>
        )}
      </section>

      <SuggestionBox onSuggest={onSuggest} />
    </div>
  );
}

function SuggestionBox({ onSuggest }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await onSuggest(text.trim());
    setText("");
    setSent(true);
    setSending(false);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <section style={{ padding: "10px 0 40px" }}>
      <div className="card" style={{ borderRadius: 4, padding: 20, borderLeft: `4px solid ${C.amber}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Lightbulb size={18} color={C.amberDeep} />
          <span className="disp" style={{ fontSize: 16 }}>Un service manque au carnet ?</span>
        </div>
        <p className="sans" style={{ fontSize: 13, color: "#6b6353", margin: "0 0 12px" }}>
          Dites-nous quel type de prestataire vous aimeriez trouver ici — on étudie chaque suggestion.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Ex. : peintre en bâtiment, menuisier, coiffeuse à domicile…"
            style={{ ...inputStyle, flex: "1 1 260px" }}
          />
          <button className="btn" onClick={submit} disabled={sending} style={{ background: C.ink, color: "#fff", padding: "0 18px", borderRadius: 3 }}>
            Envoyer
          </button>
        </div>
        {sent && <p className="sans" style={{ fontSize: 12, color: C.stamp, marginTop: 8, fontWeight: 700 }}>Merci, suggestion transmise !</p>}
      </div>
    </section>
  );
}

function EmptyState({ onNav }) {
  return (
    <div className="sans card" style={{ padding: 28, borderRadius: 4, textAlign: "center", color: "#6b6353" }}>
      <p style={{ margin: "0 0 14px" }}>Aucun profil validé pour l'instant. Soyez le premier prestataire du carnet.</p>
      <button className="btn" onClick={() => onNav({ name: "signup" })} style={{ background: C.amber, color: "#fff", padding: "10px 18px", borderRadius: 3 }}>
        Proposer un service
      </button>
    </div>
  );
}

function Stars({ rating = 0, size = 13, count }) {
  const full = Math.round(rating);
  return (
    <span className="sans" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: size }}>
      <span style={{ color: C.amber, letterSpacing: 1 }}>{"★".repeat(full)}{"☆".repeat(5 - full)}</span>
      {typeof count === "number" && <span style={{ color: "#8a8272", fontSize: size - 1 }}>({count})</span>}
    </span>
  );
}

function UserCard({ u, categories, onNav }) {
  const cat = categories.find((c) => c.id === u.category);
  return (
    <button className="btn card" onClick={() => onNav({ name: "profile", id: u.id })} style={{ textAlign: "left", padding: 16, borderRadius: 4, position: "relative", border: isBoostActive(u) ? `1px solid ${C.amber}` : `1px solid ${C.line}`, boxShadow: isBoostActive(u) ? `0 0 0 1px ${C.amber}` : "none" }}>
      {isBoostActive(u) && (
        <span className="sans" style={{ position: "absolute", top: -9, right: 12, background: C.amber, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
          <Rocket size={10} /> EN AVANT
        </span>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Avatar photo={u.photo} name={u.name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="disp" style={{ fontSize: 16 }}>{u.name}</div>
            <ShieldCheck size={16} color={C.stamp} />
          </div>
          <div className="sans" style={{ fontSize: 12, color: C.amberDeep, fontWeight: 700, marginTop: 4 }}>{cat?.label} · {u.city}</div>
          {u.ratingCount > 0 && <div style={{ marginTop: 4 }}><Stars rating={u.avgRating} count={u.ratingCount} /></div>}
        </div>
      </div>
      <p className="sans" style={{ fontSize: 13, color: "#5c5546", marginTop: 10, lineHeight: 1.5 }}>
        {u.description?.slice(0, 90)}{u.description?.length > 90 ? "…" : ""}
      </p>
    </button>
  );
}

function Avatar({ photo, name, size = 44 }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  if (photo) {
    return <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `1px solid ${C.line}` }} />;
  }
  return (
    <div className="disp" style={{ width: size, height: size, borderRadius: "50%", background: C.paperDeep, color: C.amberDeep, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, flexShrink: 0 }}>
      {initial}
    </div>
  );
}

function CategoryList({ category, users, categories, onNav }) {
  const [q, setQ] = useState("");
  const cat = categories.find((c) => c.id === category);
  const base = sortListings(users.filter((u) => u.status === "approved" && u.category === category));
  const query = q.trim().toLowerCase();
  const list = query ? base.filter((u) => u.name?.toLowerCase().includes(query) || u.city?.toLowerCase().includes(query)) : base;
  return (
    <section style={{ padding: "30px 0" }}>
      <BackBtn onNav={onNav} label="Toutes les catégories" />
      <h2 className="disp" style={{ fontSize: 28, margin: "14px 0 16px" }}>{cat?.label}</h2>
      <div className="sans" style={{ position: "relative", marginBottom: 20 }}>
        <Search size={16} color="#8a8272" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer par ville ou par nom…" style={{ ...inputStyle, width: "100%", padding: "13px 14px 13px 40px", fontSize: 14 }} />
      </div>
      {list.length === 0 ? (
        query ? <p className="sans" style={{ color: "#8a8272" }}>Aucun résultat pour cette recherche.</p> : <EmptyState onNav={onNav} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 14 }}>
          {list.map((u) => <UserCard key={u.id} u={u} categories={categories} onNav={onNav} />)}
        </div>
      )}
    </section>
  );
}

function BackBtn({ onNav, label }) {
  return (
    <button className="btn sans" onClick={() => onNav({ name: "home" })} style={{ background: "transparent", color: "#6b6353", display: "flex", alignItems: "center", gap: 4, padding: 0, fontSize: 13 }}>
      <ChevronLeft size={15} /> {label}
    </button>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { label: "En attente de validation", color: C.amberDeep, bg: "#F3E3C6" },
    approved: { label: "Profil vérifié", color: C.stamp, bg: "#DEEAE1" },
    rejected: { label: "Profil refusé", color: C.rust, bg: "#F1DCD7" },
  };
  const s = map[status] || map.pending;
  return (
    <span className="sans" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: s.color, background: s.bg, padding: "5px 10px", borderRadius: 3 }}>
      {status === "approved" ? <ShieldCheck size={13} /> : <Clock size={13} />} {s.label}
    </span>
  );
}

function Profile({ user, me, categories, onNav, flash, onRequestBoost, onCancelBoostRequest, onUpdateUser, onUpdateRating, onReport }) {
  const [msg, setMsg] = useState("");
  const [thread, setThread] = useState([]);
  const [sending, setSending] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);

  const convoKey = user && me ? `messages:${[user.id, me.id].sort().join("_")}` : null;
  const reviewsKey = user ? `reviews:${user.id}` : null;

  const loadThread = useCallback(async () => {
    if (!convoKey) return;
    try {
      const r = await storage.get(convoKey, true);
      setThread(r?.value ? JSON.parse(r.value) : []);
    } catch (e) {
      setThread([]);
    }
  }, [convoKey]);

  const loadReviews = useCallback(async () => {
    if (!reviewsKey) return;
    try {
      const r = await storage.get(reviewsKey, true);
      setReviews(r?.value ? JSON.parse(r.value) : []);
    } catch (e) {
      setReviews([]);
    }
  }, [reviewsKey]);

  useEffect(() => { loadThread(); loadReviews(); }, [loadThread, loadReviews]);

  if (!user) {
    return (
      <section style={{ padding: "30px 0" }}>
        <BackBtn onNav={onNav} label="Retour" />
        <p className="sans" style={{ marginTop: 20 }}>Profil introuvable.</p>
      </section>
    );
  }

  const cat = categories.find((c) => c.id === user.category);
  const isOwner = me?.id === user.id;

  if (isOwner && editing) {
    return (
      <EditProfileForm
        user={user}
        categories={categories}
        onCancel={() => setEditing(false)}
        onSave={async (updated) => {
          await onUpdateUser({ ...user, ...updated });
          setEditing(false);
          flash("Profil mis à jour.");
        }}
      />
    );
  }

  const send = async () => {
    if (!msg.trim() || !me || sending) return;
    setSending(true);
    const next = [...thread, { from: me.id, fromName: me.name, text: msg.trim(), at: Date.now() }];
    try {
      await storage.set(convoKey, JSON.stringify(next), true);
      setThread(next);
      setMsg("");
    } catch (e) {
      flash("Message non envoyé — réessayez.");
    }
    setSending(false);
  };

  const submitReview = async (rating, comment) => {
    const review = { id: uid(), author: me.name, rating, comment: comment.trim(), at: Date.now() };
    const next = [...reviews, review];
    await storage.set(reviewsKey, JSON.stringify(next), true);
    setReviews(next);
    const avg = next.reduce((s, r) => s + r.rating, 0) / next.length;
    await onUpdateRating(user, Math.round(avg * 10) / 10, next.length);
    flash("Merci pour votre avis !");
  };

  return (
    <section style={{ padding: "30px 0" }}>
      <BackBtn onNav={onNav} label="Retour" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Avatar photo={user.photo} name={user.name} size={64} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 className="disp" style={{ fontSize: 28, margin: 0 }}>{user.name}</h2>
              {user.boosted && (
                <span className="sans" style={{ background: C.amber, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Rocket size={10} /> EN AVANT
                </span>
              )}            </div>
            <div className="sans" style={{ color: C.amberDeep, fontWeight: 700, fontSize: 14, marginTop: 4 }}>{cat?.label} · {user.city}</div>
            {user.ratingCount > 0 && <div style={{ marginTop: 6 }}><Stars rating={user.avgRating} count={user.ratingCount} size={14} /></div>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <StatusBadge status={user.status} />
          {isOwner ? (
            <button className="btn sans" onClick={() => setEditing(true)} style={{ background: "transparent", border: `1px solid ${C.line}`, color: "#6b6353", padding: "6px 12px", borderRadius: 3, fontSize: 12 }}>
              Modifier mon profil
            </button>
          ) : (
            <button className="btn sans" onClick={() => setReporting(true)} style={{ background: "transparent", color: "#a89f8c", padding: 0, fontSize: 11, textDecoration: "underline" }}>
              Signaler ce profil
            </button>
          )}
        </div>
      </div>

      {reporting && !isOwner && (
        <ReportBox
          onCancel={() => setReporting(false)}
          onSubmit={async (reason) => {
            await onReport(user.id, user.name, reason);
            setReporting(false);
          }}
        />
      )}

      {user.status === "pending" && isOwner && (
        <div className="sans card" style={{ padding: 14, borderRadius: 4, marginTop: 18, fontSize: 13, color: "#6b6353", borderLeft: `4px solid ${C.amber}` }}>
          Votre profil est en attente de validation. Il apparaîtra publiquement une fois vérifié.
        </div>
      )}
      {user.status === "rejected" && isOwner && (
        <div className="sans card" style={{ padding: 14, borderRadius: 4, marginTop: 18, fontSize: 13, color: "#6b6353", borderLeft: `4px solid ${C.rust}` }}>
          Ce profil a été refusé. Contactez l'équipe pour en savoir plus.
        </div>
      )}

      <p className="sans" style={{ marginTop: 20, lineHeight: 1.7, color: "#3a352a", fontSize: 15 }}>{user.description}</p>

      {user.gallery?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px,1fr))", gap: 8, marginTop: 16 }}>
          {user.gallery.map((src, i) => (
            <img key={i} src={src} alt={`Réalisation ${i + 1}`} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 4, border: `1px solid ${C.line}` }} />
          ))}
        </div>
      )}

      {isOwner && user.status === "approved" && (
        <BoostPanel user={user} onRequestBoost={onRequestBoost} onCancelBoostRequest={onCancelBoostRequest} flash={flash} />
      )}

      {!isOwner && user.status === "approved" && (
        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          <a href={`tel:${user.phone}`} className="btn sans" style={{ background: C.ink, color: "#fff", padding: "11px 18px", borderRadius: 3, display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
            <Phone size={15} /> Appeler
          </a>
          <a href={`https://wa.me/${user.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn sans" style={{ background: C.stamp, color: "#fff", padding: "11px 18px", borderRadius: 3, display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
            <MessageCircle size={15} /> WhatsApp
          </a>
        </div>
      )}

      {!isOwner && user.status === "approved" && (
        <div style={{ marginTop: 30 }}>
          <div className="sans" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "#8a8272", marginBottom: 10 }}>
            MESSAGERIE
          </div>
          {!me ? (
            <p className="sans" style={{ fontSize: 13, color: "#6b6353" }}>
              <button className="btn" onClick={() => onNav({ name: "login" })} style={{ background: "transparent", color: C.amberDeep, textDecoration: "underline", padding: 0 }}>Connectez-vous</button> pour envoyer un message.
            </p>
          ) : (
            <div className="card" style={{ borderRadius: 4, padding: 14 }}>
              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {thread.length === 0 && <p className="sans" style={{ fontSize: 13, color: "#8a8272", margin: 0 }}>Aucun message encore.</p>}
                {thread.map((m, i) => (
                  <div key={i} className="sans" style={{ alignSelf: m.from === me.id ? "flex-end" : "flex-start", background: m.from === me.id ? C.amber : C.paperDeep, color: m.from === me.id ? "#fff" : C.ink, padding: "8px 12px", borderRadius: 10, fontSize: 13, maxWidth: "80%" }}>
                    {m.text}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Votre message…" style={{ flex: 1, padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 3, fontSize: 13 }} />
                <button className="btn" onClick={send} disabled={sending} style={{ background: C.ink, color: "#fff", padding: "0 16px", borderRadius: 3 }}>Envoyer</button>
              </div>
            </div>
          )}
        </div>
      )}

      {user.status === "approved" && (
        <ReviewsSection reviews={reviews} me={me} isOwner={isOwner} onSubmit={submitReview} onLogin={() => onNav({ name: "login" })} />
      )}
    </section>
  );
}

function ReportBox({ onCancel, onSubmit }) {
  const [reason, setReason] = useState("");
  return (
    <div className="card sans" style={{ marginTop: 14, padding: 14, borderRadius: 4, borderLeft: `4px solid ${C.rust}` }}>
      <div className="disp" style={{ fontSize: 14, marginBottom: 8 }}>Signaler ce profil</div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Expliquez brièvement le problème…" style={{ ...inputStyle, width: "100%", resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn" onClick={() => reason.trim() && onSubmit(reason.trim())} style={{ background: C.rust, color: "#fff", padding: "8px 14px", borderRadius: 3, fontSize: 12 }}>Envoyer le signalement</button>
        <button className="btn" onClick={onCancel} style={{ background: "transparent", color: "#8a8272", padding: "8px 6px", fontSize: 12 }}>Annuler</button>
      </div>
    </div>
  );
}

function ReviewsSection({ reviews, me, isOwner, onSubmit, onLogin }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const sorted = [...reviews].sort((a, b) => b.at - a.at);
  const already = me && reviews.some((r) => r.author === me.name);

  return (
    <div style={{ marginTop: 34 }}>
      <div className="sans" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "#8a8272", marginBottom: 10 }}>
        AVIS {reviews.length > 0 ? `(${reviews.length})` : ""}
      </div>

      {!isOwner && me && !already && (
        <div className="card" style={{ padding: 14, borderRadius: 4, marginBottom: 16 }}>
          <div className="sans" style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Laisser un avis</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className="btn" onClick={() => setRating(n)} style={{ background: "transparent", padding: 0, fontSize: 22, color: n <= rating ? C.amber : "#d8d2c2" }}>★</button>
            ))}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Votre expérience avec ce prestataire…" style={{ ...inputStyle, width: "100%", resize: "vertical", fontSize: 13 }} />
          <button className="btn sans" onClick={() => { onSubmit(rating, comment); setComment(""); setRating(5); }} style={{ background: C.ink, color: "#fff", padding: "8px 16px", borderRadius: 3, marginTop: 8, fontSize: 12 }}>
            Publier l'avis
          </button>
        </div>
      )}
      {!isOwner && !me && (
        <p className="sans" style={{ fontSize: 13, color: "#6b6353", marginBottom: 16 }}>
          <button className="btn" onClick={onLogin} style={{ background: "transparent", color: C.amberDeep, textDecoration: "underline", padding: 0 }}>Connectez-vous</button> pour laisser un avis.
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="sans" style={{ fontSize: 13, color: "#8a8272" }}>Aucun avis pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((r) => (
            <div key={r.id} className="card sans" style={{ padding: 12, borderRadius: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{r.author}</span>
                <Stars rating={r.rating} />
              </div>
              {r.comment && <p style={{ fontSize: 13, color: "#5c5546", margin: "6px 0 0" }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditProfileForm({ user, categories, onSave, onCancel }) {
  const [form, setForm] = useState({ name: user.name, phone: user.phone, city: user.city, category: user.category, description: user.description, photo: user.photo || null, gallery: user.gallery || [] });
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch (e) {
      setErr("Photo non lue.");
    }
    setUploading(false);
  };

  const handleGalleryAdd = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (form.gallery.length + files.length > 6) {
      setErr("6 photos de galerie maximum.");
      return;
    }
    setUploading(true);
    try {
      const dataUrls = await Promise.all(files.map((f) => fileToCompressedDataUrl(f, 400, 0.68)));
      setForm((f) => ({ ...f, gallery: [...f.gallery, ...dataUrls] }));
      setErr("");
    } catch (e) {
      setErr("Une ou plusieurs photos n'ont pas pu être lues.");
    }
    setUploading(false);
  };

  const removeGalleryPhoto = (i) => setForm((f) => ({ ...f, gallery: f.gallery.filter((_, idx) => idx !== i) }));

  const submit = () => {
    if (!form.name.trim() || !form.phone.trim() || !form.city.trim() || !form.description.trim()) {
      setErr("Merci de remplir tous les champs.");
      return;
    }
    onSave(form);
  };

  return (
    <section style={{ padding: "30px 0", maxWidth: 520 }}>
      <button className="btn sans" onClick={onCancel} style={{ background: "transparent", color: "#6b6353", display: "flex", alignItems: "center", gap: 4, padding: 0, fontSize: 13 }}>
        <ChevronLeft size={15} /> Annuler
      </button>
      <h2 className="disp" style={{ fontSize: 26, margin: "14px 0 20px" }}>Modifier mon profil</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Photo de profil">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar photo={form.photo} name={form.name} size={56} />
            <label className="btn sans" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.ink, padding: "9px 14px", borderRadius: 3, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13 }}>
              <Camera size={15} /> {uploading ? "Chargement…" : "Changer la photo"}
              <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
            </label>
          </div>
        </Field>
        <Field label="Nom complet"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} /></Field>
        <Field label="Téléphone / WhatsApp"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} /></Field>
        <Field label="Ville"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={inputStyle} /></Field>
        <Field label="Catégorie">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Description de votre activité">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        <Field label={`Galerie de réalisations (${form.gallery.length}/6)`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px,1fr))", gap: 8, marginBottom: 8 }}>
            {form.gallery.map((src, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={src} alt="" style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 3, border: `1px solid ${C.line}` }} />
                <button className="btn" onClick={() => removeGalleryPhoto(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: C.rust, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          {form.gallery.length < 6 && (
            <label className="btn sans" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.ink, padding: "9px 14px", borderRadius: 3, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13 }}>
              <Camera size={15} /> Ajouter des photos
              <input type="file" accept="image/*" multiple onChange={handleGalleryAdd} style={{ display: "none" }} />
            </label>
          )}
        </Field>
        {err && <p className="sans" style={{ color: C.rust, fontSize: 13, margin: 0 }}>{err}</p>}
        <button className="btn" onClick={submit} style={{ background: C.amber, color: "#fff", padding: "13px 18px", borderRadius: 3, marginTop: 6 }}>
          Enregistrer les modifications
        </button>
      </div>
    </section>
  );
}

function BoostPanel({ user, onRequestBoost, onCancelBoostRequest, flash }) {
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);
  const active = isBoostActive(user);
  const remaining = daysLeft(user);
  const req = user.boostRequest;

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(MOMO_NUMBER.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  // Une demande de paiement est en attente de confirmation par l'admin.
  if (req) {
    return (
      <div className="card" style={{ marginTop: 20, padding: 18, borderRadius: 4, borderLeft: `4px solid ${C.amber}` }}>
        <div className="disp" style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Rocket size={15} color={C.amberDeep} /> Paiement en attente de confirmation
        </div>
        <p className="sans" style={{ fontSize: 13, color: "#3a352a", lineHeight: 1.7, margin: 0 }}>
          Envoyez <b>{fcfa(req.amount)}</b> par Mobile Money (MTN/Moov) au numéro <b>{MOMO_NUMBER}</b>, en indiquant la référence <b>{req.reference}</b>. Votre annonce passera en avant dès que le transfert sera vérifié.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn sans" onClick={copyNumber} style={{ background: C.ink, color: "#fff", padding: "8px 14px", borderRadius: 3, fontSize: 12 }}>
            {copied ? "Numéro copié ✓" : "Copier le numéro"}
          </button>
          <button className="btn sans" onClick={() => onCancelBoostRequest(user)} style={{ background: "transparent", border: `1px solid ${C.line}`, color: "#6b6353", padding: "8px 14px", borderRadius: 3, fontSize: 12 }}>
            Annuler la demande
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 20, padding: 18, borderRadius: 4, borderLeft: `4px solid ${C.amber}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="disp" style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
            <Rocket size={15} color={C.amberDeep} /> Mise en avant
          </div>
          <p className="sans" style={{ fontSize: 12, color: "#6b6353", margin: "4px 0 0" }}>
            {active
              ? `Active — s'affiche en premier dans sa catégorie${remaining != null ? ` (encore ${remaining} jour${remaining !== 1 ? "s" : ""})` : ""}.`
              : "Passez en tête des résultats de votre catégorie et de l'accueil, par transfert Mobile Money."}
          </p>
        </div>
        {!active && (
          <button className="btn sans" onClick={() => setPicking((v) => !v)} style={{ background: C.amber, color: "#fff", padding: "10px 16px", borderRadius: 3, display: "flex", alignItems: "center", gap: 6 }}>
            <Rocket size={14} /> Booster mon annonce
          </button>
        )}
      </div>

      {picking && !active && (
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {BOOST_OFFERS.map((o) => (
            <button
              key={o.days}
              className="btn"
              onClick={async () => {
                const ref = await onRequestBoost(user, o.days);
                flash(`Instructions de paiement générées — réf. ${ref || ""}`);
                setPicking(false);
              }}
              style={{ flex: "1 1 160px", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 4, padding: "14px 16px", textAlign: "left" }}
            >
              <div className="disp" style={{ fontSize: 18 }}>{o.days} jours</div>
              <div className="sans" style={{ fontSize: 13, color: C.amberDeep, fontWeight: 700, marginTop: 4 }}>{fcfa(o.amount)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Signup({ me, categories, onCreated, onNav }) {
  const [form, setForm] = useState({ name: "", phone: "", city: "", category: categories[0]?.id || "", description: "", password: "", photo: null });
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.city.trim() || !form.description.trim() || !form.password.trim()) {
      setErr("Merci de remplir tous les champs.");
      return;
    }
    const u = { id: uid(), ...form, password: simpleHash(form.password), status: "pending", createdAt: Date.now(), gallery: [] };
    await onCreated(u);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Le fichier doit être une image.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setForm((f) => ({ ...f, photo: dataUrl }));
      setErr("");
    } catch (e) {
      setErr("Photo non lue — réessayez avec une autre image.");
    }
    setUploading(false);
  };

  return (
    <section style={{ padding: "30px 0", maxWidth: 520 }}>
      <BackBtn onNav={onNav} label="Retour" />
      <h2 className="disp" style={{ fontSize: 28, margin: "14px 0 4px" }}>Proposer un service</h2>
      <p className="sans" style={{ fontSize: 13, color: "#6b6353", marginBottom: 20 }}>Votre profil sera vérifié avant publication.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Photo de profil">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar photo={form.photo} name={form.name} size={56} />
            <label className="btn sans" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.ink, padding: "9px 14px", borderRadius: 3, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13 }}>
              <Camera size={15} /> {uploading ? "Chargement…" : form.photo ? "Changer la photo" : "Ajouter une photo"}
              <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
            </label>
          </div>
        </Field>
        <Field label="Nom complet"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} /></Field>
        <Field label="Téléphone / WhatsApp"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+229 ..." style={inputStyle} /></Field>
        <Field label="Ville"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={inputStyle} /></Field>
        <Field label="Catégorie">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Description de votre activité">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        <Field label="Mot de passe (pour vous reconnecter)">
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inputStyle} />
        </Field>
        {err && <p className="sans" style={{ color: C.rust, fontSize: 13, margin: 0 }}>{err}</p>}
        <button className="btn" onClick={submit} style={{ background: C.amber, color: "#fff", padding: "13px 18px", borderRadius: 3, marginTop: 6 }}>
          Envoyer pour validation
        </button>
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="sans" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#6b6353", letterSpacing: "0.03em" }}>
      {label.toUpperCase()}
      {children}
    </label>
  );
}

const inputStyle = { padding: "11px 12px", border: `1px solid ${C.line}`, borderRadius: 3, fontSize: 14, background: "#fff", color: C.ink };

function Login({ users, onLogin, onNav }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    const u = users.find((x) => x.phone === phone.trim() && x.password === simpleHash(password));
    if (!u) {
      setErr("Téléphone ou mot de passe incorrect.");
      return;
    }
    onLogin(u);
  };

  return (
    <section style={{ padding: "30px 0", maxWidth: 420 }}>
      <BackBtn onNav={onNav} label="Retour" />
      <h2 className="disp" style={{ fontSize: 28, margin: "14px 0 20px" }}>Connexion</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Téléphone"><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} /></Field>
        <Field label="Mot de passe"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle} /></Field>
        {err && <p className="sans" style={{ color: C.rust, fontSize: 13, margin: 0 }}>{err}</p>}
        <button className="btn" onClick={submit} style={{ background: C.ink, color: "#fff", padding: "13px 18px", borderRadius: 3 }}>Se connecter</button>
        <p className="sans" style={{ fontSize: 13, color: "#6b6353" }}>
          Pas encore de profil ? <button className="btn" onClick={() => onNav({ name: "signup" })} style={{ background: "transparent", color: C.amberDeep, textDecoration: "underline", padding: 0 }}>Proposer un service</button>
        </p>
      </div>
    </section>
  );
}

function Admin({ users, categories, suggestions, reports, boostHistory, onDecision, onAddCategory, onRenameCategory, onDeleteCategory, onSuggestionUpdate, onToggleBoost, onConfirmBoost, onRejectBoostRequest, onReportUpdate, onNav }) {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const pending = users.filter((u) => u.status === "pending");
  const decided = users.filter((u) => u.status !== "pending");
  const boostRequests = users.filter((u) => u.boostRequest);
  const newSuggestions = suggestions.filter((s) => s.status === "new").sort((a, b) => b.createdAt - a.createdAt);
  const handledSuggestions = suggestions.filter((s) => s.status !== "new");
  const newReports = reports.filter((r) => r.status === "new").sort((a, b) => b.createdAt - a.createdAt);
  const handledReports = reports.filter((r) => r.status !== "new");

  if (!unlocked) {
    return (
      <section style={{ padding: "30px 0", maxWidth: 360 }}>
        <BackBtn onNav={onNav} label="Retour" />
        <h2 className="disp" style={{ fontSize: 24, margin: "14px 0 16px" }}>Espace validation</h2>
        <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code d'accès" style={{ ...inputStyle, width: "100%" }} onKeyDown={(e) => e.key === "Enter" && code === "admin2026" && setUnlocked(true)} />
        <button className="btn" onClick={() => setUnlocked(code === "admin2026")} style={{ background: C.ink, color: "#fff", padding: "11px 16px", borderRadius: 3, marginTop: 10 }}>Entrer</button>
        <p className="sans" style={{ fontSize: 12, color: "#8a8272", marginTop: 10 }}>Code de démonstration : admin2026 (à personnaliser).</p>
      </section>
    );
  }

  return (
    <section style={{ padding: "30px 0" }}>
      <BackBtn onNav={onNav} label="Retour" />
      <h2 className="disp" style={{ fontSize: 26, margin: "14px 0 20px" }}>À valider ({pending.length})</h2>
      {pending.length === 0 && <p className="sans" style={{ color: "#8a8272" }}>Rien en attente.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pending.map((u) => (
          <div key={u.id} className="card" style={{ padding: 14, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div className="disp" style={{ fontSize: 15 }}>{u.name} <span className="sans" style={{ fontWeight: 400, color: "#8a8272", fontSize: 12 }}>· {categories.find(c => c.id === u.category)?.label} · {u.city}</span></div>
              <p className="sans" style={{ fontSize: 12, color: "#6b6353", margin: "4px 0 0", maxWidth: 480 }}>{u.description}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => onDecision(u, "approved")} style={{ background: C.stamp, color: "#fff", padding: "8px 14px", borderRadius: 3, display: "flex", alignItems: "center", gap: 5 }}><Check size={14} /> Valider</button>
              <button className="btn" onClick={() => onDecision(u, "rejected")} style={{ background: C.rust, color: "#fff", padding: "8px 14px", borderRadius: 3, display: "flex", alignItems: "center", gap: 5 }}><X size={14} /> Refuser</button>
            </div>
          </div>
        ))}
      </div>

      {decided.length > 0 && (
        <>
          <h3 className="disp" style={{ fontSize: 18, margin: "30px 0 12px" }}>Déjà traités</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {decided.map((u) => (
            <div key={u.id} className="card" style={{ padding: 14, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div className="disp" style={{ fontSize: 15 }}>{u.name} <span className="sans" style={{ fontWeight: 400, color: "#8a8272", fontSize: 12 }}>· {categories.find(c => c.id === u.category)?.label}</span></div>
                <StatusBadge status={u.status} />
              </div>
              {u.status === "approved" && (
                <button className="btn sans" onClick={() => onToggleBoost(u)} style={{ background: isBoostActive(u) ? C.amber : "transparent", border: isBoostActive(u) ? "none" : `1px solid ${C.line}`, color: isBoostActive(u) ? "#fff" : "#6b6353", padding: "6px 12px", borderRadius: 3, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <Rocket size={12} /> {isBoostActive(u) ? "Retirer boost" : "Booster (offert)"}
                </button>
              )}
            </div>
            ))}
          </div>
        </>
      )}

      <BoostRequestsPanel requests={boostRequests} onConfirmBoost={onConfirmBoost} onRejectBoostRequest={onRejectBoostRequest} />
      <BoostHistoryPanel history={boostHistory} />
      <ReportsPanel reports={newReports} handled={handledReports} onReportUpdate={onReportUpdate} onNav={onNav} />
      <SuggestionsPanel suggestions={newSuggestions} handled={handledSuggestions} onSuggestionUpdate={onSuggestionUpdate} onAddCategory={onAddCategory} />
      <CategoryManager categories={categories} users={users} onAddCategory={onAddCategory} onRenameCategory={onRenameCategory} onDeleteCategory={onDeleteCategory} />
    </section>
  );
}

function BoostHistoryPanel({ history }) {
  const sorted = [...history].sort((a, b) => b.confirmedAt - a.confirmedAt);
  const total = history.reduce((s, h) => s + h.amount, 0);
  return (
    <div style={{ marginTop: 44 }}>
      <h3 className="disp" style={{ fontSize: 20, margin: "0 0 4px" }}>Historique des paiements ({history.length})</h3>
      {history.length > 0 && <p className="sans" style={{ fontSize: 12, color: "#8a8272", margin: "0 0 14px" }}>Total encaissé : {fcfa(total)}</p>}
      {sorted.length === 0 ? (
        <p className="sans" style={{ color: "#8a8272", fontSize: 13 }}>Aucune mise en avant confirmée pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((h, i) => (
            <div key={i} className="sans" style={{ fontSize: 12, display: "flex", justifyContent: "space-between", padding: "8px 4px", borderBottom: `1px solid ${C.line}` }}>
              <span>{h.userName} · {h.days}j · réf. {h.reference}</span>
              <span style={{ fontWeight: 700 }}>{fcfa(h.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportsPanel({ reports, handled, onReportUpdate, onNav }) {
  return (
    <div style={{ marginTop: 44 }}>
      <h3 className="disp" style={{ fontSize: 20, margin: "0 0 14px" }}>Signalements ({reports.length})</h3>
      {reports.length === 0 && <p className="sans" style={{ color: "#8a8272", fontSize: 13 }}>Aucun signalement en attente.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {reports.map((r) => (
          <div key={r.id} className="card" style={{ padding: 14, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <button className="btn disp" onClick={() => onNav({ name: "profile", id: r.userId })} style={{ background: "transparent", padding: 0, fontSize: 15, textDecoration: "underline" }}>{r.userName}</button>
              <p className="sans" style={{ fontSize: 12, color: "#6b6353", margin: "4px 0 0" }}>{r.reason}</p>
              <p className="sans" style={{ fontSize: 11, color: "#a89f8c", margin: "4px 0 0" }}>Signalé par {r.from}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => onReportUpdate({ ...r, status: "resolved" })} style={{ background: C.stamp, color: "#fff", padding: "8px 14px", borderRadius: 3, fontSize: 12 }}>Traité</button>
              <button className="btn" onClick={() => onReportUpdate({ ...r, status: "dismissed" })} style={{ background: "transparent", border: `1px solid ${C.line}`, color: "#6b6353", padding: "8px 14px", borderRadius: 3, fontSize: 12 }}>Ignorer</button>
            </div>
          </div>
        ))}
      </div>
      {handled.length > 0 && (
        <details className="sans" style={{ marginTop: 16, fontSize: 12, color: "#8a8272" }}>
          <summary style={{ cursor: "pointer" }}>Signalements traités ({handled.length})</summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {handled.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.line}` }}>
                <span>{r.userName} — {r.reason.slice(0, 40)}</span>
                <span>{r.status === "resolved" ? "Traité" : "Ignoré"}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function BoostRequestsPanel({ requests, onConfirmBoost, onRejectBoostRequest }) {
  return (
    <div style={{ marginTop: 44 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Rocket size={18} color={C.amberDeep} />
        <h3 className="disp" style={{ fontSize: 20, margin: 0 }}>Demandes de mise en avant ({requests.length})</h3>
      </div>
      {requests.length === 0 && <p className="sans" style={{ color: "#8a8272", fontSize: 13 }}>Aucun paiement en attente de vérification.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {requests.map((u) => (
          <div key={u.id} className="card" style={{ padding: 14, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div className="disp" style={{ fontSize: 15 }}>{u.name}</div>
              <p className="sans" style={{ fontSize: 12, color: "#6b6353", margin: "4px 0 0" }}>
                {u.boostRequest.days} jours · {fcfa(u.boostRequest.amount)} · réf. <b>{u.boostRequest.reference}</b>
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => onConfirmBoost(u)} style={{ background: C.stamp, color: "#fff", padding: "8px 14px", borderRadius: 3, display: "flex", alignItems: "center", gap: 5 }}><Check size={14} /> Paiement reçu</button>
              <button className="btn" onClick={() => onRejectBoostRequest(u)} style={{ background: C.rust, color: "#fff", padding: "8px 14px", borderRadius: 3, display: "flex", alignItems: "center", gap: 5 }}><X size={14} /> Refuser</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestionsPanel({ suggestions, handled, onSuggestionUpdate, onAddCategory }) {
  return (
    <div style={{ marginTop: 44 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Lightbulb size={18} color={C.amberDeep} />
        <h3 className="disp" style={{ fontSize: 20, margin: 0 }}>Suggestions des clients ({suggestions.length})</h3>
      </div>
      {suggestions.length === 0 && <p className="sans" style={{ color: "#8a8272", fontSize: 13 }}>Aucune nouvelle suggestion.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {suggestions.map((s) => (
          <SuggestionRow key={s.id} s={s} onSuggestionUpdate={onSuggestionUpdate} onAddCategory={onAddCategory} />
        ))}
      </div>

      {handled.length > 0 && (
        <details className="sans" style={{ marginTop: 16, fontSize: 12, color: "#8a8272" }}>
          <summary style={{ cursor: "pointer" }}>Suggestions déjà traitées ({handled.length})</summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {handled.map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.line}` }}>
                <span>{s.text}</span>
                <span>{s.status === "added" ? "Ajoutée" : "Ignorée"}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function SuggestionRow({ s, onSuggestionUpdate, onAddCategory }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(s.text);
  const [icon, setIcon] = useState("wrench");

  const createCategory = async () => {
    if (!label.trim()) return;
    await onAddCategory({ label: label.trim(), icon });
    await onSuggestionUpdate({ ...s, status: "added" });
    setEditing(false);
  };

  return (
    <div className="card" style={{ padding: 14, borderRadius: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <p className="sans" style={{ margin: 0, fontSize: 14, color: C.ink }}>{s.text}</p>
          <p className="sans" style={{ margin: "4px 0 0", fontSize: 11, color: "#8a8272" }}>Proposé par {s.from}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className="btn" onClick={() => setEditing((v) => !v)} style={{ background: C.amber, color: "#fff", padding: "7px 12px", borderRadius: 3, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <Sparkles size={13} /> Créer une catégorie
          </button>
          <button className="btn" onClick={() => onSuggestionUpdate({ ...s, status: "dismissed" })} style={{ background: "transparent", border: `1px solid ${C.line}`, color: "#6b6353", padding: "7px 12px", borderRadius: 3, fontSize: 12 }}>
            Ignorer
          </button>
        </div>
      </div>
      {editing && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ ...inputStyle, flex: "1 1 180px" }} placeholder="Nom de la catégorie" />
          <select value={icon} onChange={(e) => setIcon(e.target.value)} style={inputStyle}>
            <option value="wrench">Outil</option>
            <option value="zap">Électricité</option>
            <option value="bag">Vente</option>
          </select>
          <button className="btn" onClick={createCategory} style={{ background: C.stamp, color: "#fff", padding: "0 16px", borderRadius: 3 }}>Valider</button>
        </div>
      )}
    </div>
  );
}

function CategoryManager({ categories, users, onAddCategory, onRenameCategory, onDeleteCategory }) {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("wrench");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");

  const submit = async () => {
    if (!label.trim()) return;
    await onAddCategory({ label: label.trim(), icon });
    setLabel("");
    setOpen(false);
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditLabel(c.label);
  };

  const saveEdit = async (id) => {
    if (editLabel.trim()) await onRenameCategory(id, editLabel.trim());
    setEditingId(null);
  };

  const remove = async (c) => {
    const inUse = users.some((u) => u.category === c.id);
    if (inUse) {
      alert("Cette catégorie est utilisée par au moins un prestataire — renommez-la plutôt, ou réaffectez d'abord ces profils.");
      return;
    }
    if (window.confirm(`Supprimer la catégorie « ${c.label} » ?`)) {
      await onDeleteCategory(c.id);
    }
  };

  return (
    <div style={{ marginTop: 44 }}>
      <h3 className="disp" style={{ fontSize: 20, margin: "0 0 14px" }}>Catégories du site ({categories.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {categories.map((c) => (
          <div key={c.id} className="card" style={{ padding: "8px 12px", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            {editingId === c.id ? (
              <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit(c.id)} style={{ ...inputStyle, flex: 1, padding: "6px 10px" }} />
            ) : (
              <span className="sans" style={{ fontSize: 13 }}>{c.label}</span>
            )}
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {editingId === c.id ? (
                <button className="btn sans" onClick={() => saveEdit(c.id)} style={{ background: C.stamp, color: "#fff", padding: "5px 10px", borderRadius: 3, fontSize: 11 }}>Sauver</button>
              ) : (
                <button className="btn sans" onClick={() => startEdit(c)} style={{ background: "transparent", border: `1px solid ${C.line}`, color: "#6b6353", padding: "5px 10px", borderRadius: 3, fontSize: 11 }}>Renommer</button>
              )}
              <button className="btn sans" onClick={() => remove(c)} style={{ background: "transparent", color: C.rust, padding: "5px 10px", borderRadius: 3, fontSize: 11 }}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
      {!open ? (
        <button className="btn" onClick={() => setOpen(true)} style={{ background: C.ink, color: "#fff", padding: "10px 16px", borderRadius: 3, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Ajouter une catégorie
        </button>
      ) : (
        <div className="card" style={{ padding: 14, borderRadius: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. : Menuiserie" style={{ ...inputStyle, flex: "1 1 180px" }} />
          <select value={icon} onChange={(e) => setIcon(e.target.value)} style={inputStyle}>
            <option value="wrench">Outil</option>
            <option value="zap">Électricité</option>
            <option value="bag">Vente</option>
          </select>
          <button className="btn" onClick={submit} style={{ background: C.stamp, color: "#fff", padding: "10px 16px", borderRadius: 3 }}>Créer</button>
          <button className="btn" onClick={() => setOpen(false)} style={{ background: "transparent", color: "#8a8272", padding: "10px 6px" }}>Annuler</button>
        </div>
      )}
    </div>
  );
}
