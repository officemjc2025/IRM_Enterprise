import { ViewOwnerPage } from "@/features/owner/pages";

interface Props {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: Props) {
  return <ViewOwnerPage params={params} />;
}
