import ActionButton from "@/components/ActionButton";
import PageHeader from "@/components/PageHeader";
import PromoForm from "@/components/admin/PromoForm";
import { adminSetPromoActive } from "@/app/admin/promo/actions";
import { requireAdmin } from "@/lib/admin";

type Promo = { code: string; label: string | null; max_uses: number | null; used: number; active: boolean };

export default async function PromoPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_promo_codes");
  const codes = (data ?? []) as Promo[];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Promo codes" title="Free registration codes">A student types the code on their dashboard and is registered without paying. Use it for the organizing team, partners and guests. Share codes privately.</PageHeader>
      <PromoForm />
      <section aria-labelledby="codes-h">
        <h2 id="codes-h" className="font-heading text-xl font-semibold">Your codes</h2>
        {codes.length === 0 ? <p className="mt-3 text-[15px] text-muted">None yet.</p> : (
          <ul className="mt-3 space-y-3">
            {codes.map((c) => {
              const full = c.max_uses != null && c.used >= c.max_uses;
              return (
                <li key={c.code} className="panel flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-lg font-semibold tracking-wider">{c.code}</p>
                    <p className="mt-1 text-sm text-muted">
                      <span className={`chip mr-2 ${c.active && !full ? "border-ok text-ok" : ""}`}>{!c.active ? "Off" : full ? "Used up" : "Live"}</span>
                      {c.label ? `${c.label} · ` : ""}{c.used} used{c.max_uses != null ? ` of ${c.max_uses}` : ""}
                    </p>
                  </div>
                  <ActionButton variant="secondary" action={adminSetPromoActive.bind(null, c.code, !c.active)}>{c.active ? "Turn off" : "Turn on"}</ActionButton>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
