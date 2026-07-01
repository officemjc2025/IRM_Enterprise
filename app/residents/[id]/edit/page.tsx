import { EditResidentAssignmentPage } from "@/features/resident-assignment/pages";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  return <EditResidentAssignmentPage params={params} />;
}
