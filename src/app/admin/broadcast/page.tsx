import BroadcastForm from "@/components/admin/BroadcastForm";
import PageHeader from "@/components/PageHeader";
import { audienceCounts } from "@/app/admin/actions";

export default async function BroadcastPage() {
  const counts = await audienceCounts();
  return (
    <div>
      <PageHeader eyebrow="Announce" title="Email students">For schedule changes, venue news and same-day emergencies. Every send is logged with who sent it and to whom.</PageHeader>
      <BroadcastForm counts={counts} />
    </div>
  );
}
