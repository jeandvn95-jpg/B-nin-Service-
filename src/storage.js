import { supabase } from "./supabaseClient";

function personalGet(key) {
  try {
    const raw = localStorage.getItem(`kv:${key}`);
    return raw ? { key, value: raw, shared: false } : null;
  } catch (e) {
    return null;
  }
}

function personalSet(key, value) {
  try {
    localStorage.setItem(`kv:${key}`, value);
    return { key, value, shared: false };
  } catch (e) {
    return null;
  }
}

function personalDelete(key) {
  try {
    localStorage.removeItem(`kv:${key}`);
    return { key, deleted: true, shared: false };
  } catch (e) {
    return null;
  }
}

export const storage = {
  async get(key, shared = false) {
    if (!shared) return personalGet(key);
    const { data, error } = await supabase
      .from("kv_store")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    return { key, value: data.value, shared: true };
  },

  async set(key, value, shared = false) {
    if (!shared) return personalSet(key, value);
    const { error } = await supabase
      .from("kv_store")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) {
      console.error("storage.set error:", error.message);
      return null;
    }
    return { key, value, shared: true };
  },

  async delete(key, shared = false) {
    if (!shared) return personalDelete(key);
    const { error } = await supabase.from("kv_store").delete().eq("key", key);
    if (error) return null;
    return { key, deleted: true, shared: true };
  },
};
