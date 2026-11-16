import BannerList, { type BannerItem } from "@/components/BannerList";
import { createClient } from "@/lib/supabase/server";

// Organizer banners for this student (audience is worked out in the database).
export default async function Banners() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_banners");
  const list = (data ?? []) as BannerItem[];
  return list.length ? <BannerList banners={list} /> : null;
}
