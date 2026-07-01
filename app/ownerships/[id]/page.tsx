import { ViewOwnershipPage } from "@/features/ownership/pages";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  return <ViewOwnershipPage params={params} />;
}
