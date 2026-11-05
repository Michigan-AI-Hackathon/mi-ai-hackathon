import { redirect } from "next/navigation";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  if (c) redirect(`/messages/${c}`);
  return <p className="m-auto hidden text-[15px] text-muted lg:block">Select a conversation</p>;
}
