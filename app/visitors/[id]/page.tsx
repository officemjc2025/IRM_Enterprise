import VisitorDetailPage from "@/features/visitor/pages/VisitorDetailPage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  return <VisitorDetailPage params={params} />;
}
