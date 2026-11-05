import Inbox from "./Inbox";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  return <Inbox selected={c ?? null} />;
}
