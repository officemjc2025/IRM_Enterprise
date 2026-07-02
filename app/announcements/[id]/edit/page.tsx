import { use } from "react";
import { AnnouncementFormPage } from "@/features/announcement/pages";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  return <AnnouncementFormPage id={id} />;
}
