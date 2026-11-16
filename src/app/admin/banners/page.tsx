import ActionButton from "@/components/ActionButton";
import PageHeader from "@/components/PageHeader";
import BannerForm, { AUDIENCE_LABELS } from "@/components/admin/BannerForm";
import { adminDeleteBanner, adminSetBannerActive } from "@/app/admin/banners/actions";
import { requireAdmin } from "@/lib/admin";

type Banner = { id: string; message: string; link_url: string | null; audience: string; tone: string; active: boolean; ends_at: string | null };

export default async function BannersPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_banners");
  const banners = (data ?? []) as Banner[];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Banners" title="Message on students' homepages">A short note at the top of the dashboard. Pick who sees it and when it ends. For email, use the Email tab.</PageHeader>
      <BannerForm />
      <section aria-labelledby="live-h">
        <h2 id="live-h" className="font-heading text-xl font-semibold">Your banners</h2>
        {banners.length === 0 ? <p className="mt-3 text-[15px] text-muted">None yet.</p> : (
          <ul className="mt-3 space-y-3">
            {banners.map((b) => {
              const over = !!b.ends_at && Date.parse(b.ends_at) < Date.now();
              const live = b.active && !over;
              return (
                <li key={b.id} className="panel flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px]">{b.message}</p>
                    <p className="mt-1 text-sm text-muted">
                      <span className={`chip mr-2 ${live ? "border-ok text-ok" : ""}`}>{live ? "Live" : over ? "Ended" : "Off"}</span>
                      {AUDIENCE_LABELS[b.audience]}{b.tone === "warn" ? " · Important" : ""}{b.ends_at ? ` · until ${new Date(b.ends_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <ActionButton variant="secondary" action={adminSetBannerActive.bind(null, b.id, !b.active)}>{b.active ? "Turn off" : "Turn on"}</ActionButton>
                    <ActionButton variant="danger" confirm="Delete this banner?" action={adminDeleteBanner.bind(null, b.id)}>Delete</ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
