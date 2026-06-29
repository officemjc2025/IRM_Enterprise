import MainLayout from "@/components/layout/MainLayout";
import { EmptyState } from "@/shared/layout";

export default function Page() {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <EmptyState
          title="Security Gate (Placeholder)"
          description="Access logs, guards, and vehicle controls will be managed here."
        />
      </div>
    </MainLayout>
  );
}
