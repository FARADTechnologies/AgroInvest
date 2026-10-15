"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, Skeleton } from "@/components/ui/panel";
import { useProfile } from "@/features/applications/api";
import { ProfileForm } from "@/features/applications/profile-form";
import { useSession } from "@/features/auth/use-session";
import { EktisCheck } from "@/features/integration/ektis-check";
import { useL } from "@/lib/i18n";

function ProfileView() {
  const params = useSearchParams();
  const L = useL();
  const { data: profile, isLoading } = useProfile();
  const { data: user } = useSession();
  const investor = user?.role === "INVESTOR";
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow={L("Kabinet", "Account")}
        title={investor ? "İnvestor məlumatları" : "Sahibkar məlumatları"}
        description={
          params.get("welcome")
            ? investor
              ? "Hesabınız yaradıldı. Şəxs məlumatlarını, büdcənizi və maraq sahələrinizi daxil edin."
              : "Hesabınız yaradıldı. Elan yerləşdirmək üçün fiziki və ya hüquqi şəxs məlumatlarını daxil edin."
            : investor
              ? "Göndərilmiş müraciətlər təqdim edildiyi andakı məlumatları saxlayır; buradakı dəyişikliklər onlara təsir etmir."
              : "Bu məlumatlar elanlarınızda elan sahibi kimi istifadə olunur."
        }
      />
      <Panel>
        <PanelBody className="p-6">
          {isLoading ? (
            <Skeleton className="h-80" />
          ) : (
            <>
              {profile && investor && <EktisCheck profile={profile} className="mb-5" />}
              <ProfileForm profile={profile} onSaved={() => toast.success(L("Məlumatlar yadda saxlanıldı", "Details saved"))} />
            </>
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
