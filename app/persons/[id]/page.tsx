import { ViewPersonPage } from "@/features/person/pages";

interface Props {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: Props) {
  return <ViewPersonPage params={params} />;
}
