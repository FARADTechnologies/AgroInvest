"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, Skeleton } from "@/components/ui/panel";
import { useProfile } from "@/features/applications/api";
import { ProfileForm } from "@/features/applications/profile-form";
import { useL } from "@/lib/i18n";

function ProfileView() {
  const params = useSearchParams();
  const L = useL();
  const { data: profile, isLoading } = useProfile();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow={L("Kabinet", "Account")}
        title={L("Sahibkar məlumatları", "Applicant details")}
        description={
          params.get("welcome")
            ? L("Hesabınız yaradıldı. Müraciət etmək üçün fiziki və ya hüquqi şəxs məlumatlarını daxil edin.", "Your account is ready. Add individual or company details to apply.")
            : L("Göndərilmiş müraciətlər təqdim edildiyi andakı məlumatları saxlayır; buradakı dəyişikliklər onlara təsir etmir.", "Submitted applications keep the details as they were when sent; changes here do not affect them.")
        }
      />
      <Panel>
        <PanelBody className="p-6">
          {isLoading ? (
            <Skeleton className="h-80" />
          ) : (
            <ProfileForm profile={profile} onSaved={() => toast.success(L("Məlumatlar yadda saxlanıldı", "Details saved"))} />
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileView />
    </Suspense>
  );
}
