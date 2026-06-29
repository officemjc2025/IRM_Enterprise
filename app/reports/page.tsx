import MainLayout from "@/components/layout/MainLayout";
import { EmptyState } from "@/shared/layout";

export default function Page() {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <EmptyState
          title="Reports (Placeholder)"
          description="Operational metrics and export utilities will be available here."
        />
      </div>
    </MainLayout>
  );
}
