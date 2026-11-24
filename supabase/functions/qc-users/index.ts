// VARMEKS QC — kullanıcı yönetimi (yalnızca yöneticiler)
// İşlemler: list, create, password, update. Service role anahtarı yalnızca burada, sunucuda kullanılır.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const DOMAIN = "qc.varmeks.local";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const tr: Record<string, string> = { "ı": "i", "ğ": "g", "ü": "u", "ş": "s", "ö": "o", "ç": "c", "İ": "i" };
const toEmail = (x: unknown) => {
  let v = String(x ?? "").trim().toLowerCase().replace(/[ıığüşöçİ]/g, (c) => tr[c] ?? c);
  return v.includes("@") ? v : v.replace(/[^a-z0-9._-]/g, "") + "@" + DOMAIN;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: who, error: we } = await admin.auth.getUser(token);
    if (we || !who?.user) return json({ error: "Oturum geçersiz; çıkış yapıp tekrar girin." }, 401);
    const { data: me } = await admin.from("qc_profiles").select("rol,aktif").eq("id", who.user.id).maybeSingle();
    const body = await req.json().catch(() => ({}));
    const act = body.action;
    if (!me || me.rol !== "yonetici" || me.aktif === false) return json({ error: "Bu işlem için yönetici yetkisi gerekir." }, 403);

    if (act === "list") {
      const users: any[] = [];
      for (let page = 1; ; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 200) break;
      }
      const { data: profs } = await admin.from("qc_profiles").select("*");
      const pm = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
      return json({
        users: users.map((u) => ({
          id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
          banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
          ad: pm[u.id]?.ad || "", rol: pm[u.id]?.rol || "kullanici", aktif: pm[u.id]?.aktif ?? true,
        })),
      });
    }

    if (act === "create") {
      const email = toEmail(body.login), pw = String(body.password || ""), ad = String(body.ad || "").trim();
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(email) || email.startsWith("@")) return json({ error: "Kullanıcı adı geçersiz." }, 400);
      if (pw.length < 6) return json({ error: "Parola en az 6 karakter olmalı." }, 400);
      const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { ad } });
      if (error) return json({ error: /already|registered|exists/i.test(error.message) ? "Bu kullanıcı adı veya e-posta zaten kayıtlı." : error.message }, 400);
      await admin.from("qc_profiles").upsert({ id: data.user.id, email, ad, rol: body.rol === "yonetici" ? "yonetici" : "kullanici", aktif: true, updated_at: new Date().toISOString() });
      return json({ ok: true, email });
    }

    if (act === "password") {
      const pw = String(body.password || "");
      if (pw.length < 6) return json({ error: "Parola en az 6 karakter olmalı." }, 400);
      const { error } = await admin.auth.admin.updateUserById(String(body.id), { password: pw });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (act === "update") {
      const id = String(body.id);
      if (id === who.user.id && (body.rol === "kullanici" || body.aktif === false)) return json({ error: "Kendi yönetici yetkinizi kaldıramaz veya kendinizi pasifleştiremezsiniz." }, 400);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.ad === "string") patch.ad = body.ad.trim();
      if (body.rol === "yonetici" || body.rol === "kullanici") patch.rol = body.rol;
      if (typeof body.aktif === "boolean") patch.aktif = body.aktif;
      const { error } = await admin.from("qc_profiles").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      if (typeof body.aktif === "boolean") await admin.auth.admin.updateUserById(id, { ban_duration: body.aktif ? "none" : "876000h" });
      return json({ ok: true });
    }

    return json({ error: "Bilinmeyen işlem." }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
