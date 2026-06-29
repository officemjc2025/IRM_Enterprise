import { ViewOccupancyPage } from "@/features/occupancy/pages";

interface Props {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: Props) {
  return <ViewOccupancyPage params={params} />;
}
