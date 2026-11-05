import Inbox from "../Inbox";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Inbox selected={id} />;
}
