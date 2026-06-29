import { EditUnitPage } from "@/features/unit/pages";

interface Props {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: Props) {
  return <EditUnitPage params={params} />;
}
