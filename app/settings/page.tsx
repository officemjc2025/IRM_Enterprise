import MainLayout from "@/components/layout/MainLayout";
import { EmptyState } from "@/shared/layout";

export default function Page() {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <EmptyState
          title="Settings (Placeholder)"
          description="System configuration and general options will be customized here."
        />
      </div>
    </MainLayout>
  );
}
