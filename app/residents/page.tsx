import MainLayout from "@/components/layout/MainLayout";
import { EmptyState } from "@/shared/layout";

export default function Page() {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <EmptyState
          title="Resident Portal (Placeholder)"
          description="Resident details, portal settings, and announcements will be here."
        />
      </div>
    </MainLayout>
  );
}
