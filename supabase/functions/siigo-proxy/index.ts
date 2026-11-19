// Supabase Edge Function: siigo-proxy
// Puente entre MiniPOS (navegador) y la API de Siigo.
// - Guarda las credenciales de Siigo como secretos (no viajan al navegador).
// - Evita el bloqueo CORS de llamar a api.siigo.com desde una página web.
//
// Despliegue:
//   supabase secrets set SIIGO_USERNAME="usuario@empresa.com" SIIGO_ACCESS_KEY="xxxx" SIIGO_PARTNER_ID="MiniPOS"
//   supabase functions deploy siigo-proxy
//
// Acciones (POST JSON {action, payload}):
//   catalogos -> tipos de comprobante FV, impuestos, formas de pago y vendedores (para llenar los IDs)
//   invoice   -> crea el cliente si no existe y emite la factura electrónica

const API = "https://api.siigo.com";
const PARTNER = Deno.env.get("SIIGO_PARTNER_ID") ?? "MiniPOS";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

let token = "";
let tokenExp = 0;

async function auth(): Promise<string> {
  if (token && Date.now() < tokenExp) return token;
  const r = await fetch(`${API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Partner-Id": PARTNER },
    body: JSON.stringify({
      username: Deno.env.get("SIIGO_USERNAME"),
      access_key: Deno.env.get("SIIGO_ACCESS_KEY"),
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error("Autenticación Siigo: " + JSON.stringify(j));
  token = j.access_token;
  tokenExp = Date.now() + ((j.expires_in ?? 86400) - 600) * 1000;
  return token;
}

async function siigo(path: string, method = "GET", body?: unknown) {
  const t = await auth();
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}`, "Partner-Id": PARTNER },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: j };
}

async function ensureCustomer(c: Record<string, string>) {
  const ident = String(c.doc).replace(/-\d$/, "").replace(/\D/g, "");
  const found = await siigo(`/v1/customers?identification=${ident}`);
  if (found.ok && found.data?.results?.length) return;
  const isNit = c.tipoDoc === "NIT";
  const idType = { CC: "13", NIT: "31", CE: "22", PAS: "41" }[c.tipoDoc] ?? "13";
  const parts = String(c.nombre).trim().split(/\s+/);
  const body: Record<string, unknown> = {
    type: "Customer",
    person_type: isNit ? "Company" : "Person",
    id_type: idType,
    identification: ident,
    name: isNit ? [c.nombre] : [parts.slice(0, Math.ceil(parts.length / 2)).join(" "), parts.slice(Math.ceil(parts.length / 2)).join(" ") || "."],
    fiscal_responsibilities: [{ code: "R-99-PN" }],
    address: { address: "Sin dirección", city: { country_code: "Co", state_code: c.depto || "05", city_code: c.ciudad || "05001" } },
    phones: [{ number: "0000000" }],
    contacts: [{ first_name: parts[0] || c.nombre, last_name: parts.slice(1).join(" ") || ".", email: c.email || "sin@correo.com" }],
  };
  if (isNit) {
    const dv = String(c.doc).match(/-(\d)$/);
    if (dv) body.check_digit = dv[1];
  }
  const r = await siigo("/v1/customers", "POST", body);
  if (!r.ok) throw new Error("No se pudo crear el cliente en Siigo: " + JSON.stringify(r.data));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const { action, payload } = await req.json();
    if (action === "catalogos") {
      const [docs, taxes, pays, users] = await Promise.all([
        siigo("/v1/document-types?type=FV"),
        siigo("/v1/taxes"),
        siigo("/v1/payment-types?document_type=FV"),
        siigo("/v1/users"),
      ]);
      return reply({ comprobantesFV: docs.data, impuestos: taxes.data, formasDePago: pays.data, vendedores: users.data });
    }
    if (action === "invoice") {
      if (payload?.customer) await ensureCustomer(payload.customer);
      const r = await siigo("/v1/invoices", "POST", payload.invoice);
      return reply(r.data, r.ok ? 200 : r.status);
    }
    return reply({ error: "Acción no soportada" }, 400);
  } catch (e) {
    return reply({ error: (e as Error).message }, 500);
  }
});
