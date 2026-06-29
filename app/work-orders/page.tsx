import MainLayout from "@/components/layout/MainLayout";
import { EmptyState } from "@/shared/layout";

export default function Page() {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <EmptyState
          title="Work Orders (Placeholder)"
          description="Maintenance tracking and work requests will be managed here."
        />
      </div>
    </MainLayout>
  );
}
