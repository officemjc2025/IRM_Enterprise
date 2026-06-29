"use client";

import MainLayout from "@/components/layout/MainLayout";
import { EmptyState } from "@/shared/layout";
import { useLanguage } from "@/providers/LanguageProvider";

export default function Page() {
  const { t } = useLanguage();
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <EmptyState
          title={t.placeholder.settings}
          description={t.placeholder.settingsDesc}
        />
      </div>
    </MainLayout>
  );
}
