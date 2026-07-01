import { EditOwnershipPage } from "@/features/ownership/pages";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  return <EditOwnershipPage params={params} />;
}
