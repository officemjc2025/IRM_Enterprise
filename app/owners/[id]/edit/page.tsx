import { EditOwnerPage } from "@/features/owner/pages";

interface Props {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: Props) {
  return <EditOwnerPage params={params} />;
}
