import { EditPropertyPage } from "@/features/property/pages";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  return <EditPropertyPage params={params} />;
}
