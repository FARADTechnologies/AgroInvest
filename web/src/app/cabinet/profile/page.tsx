"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, Skeleton } from "@/components/ui/panel";
import { useProfile } from "@/features/applications/api";
import { ProfileForm } from "@/features/applications/profile-form";
import { parseCitizenship } from "@/features/auth/citizenship-choice";
import { EktisCheck } from "@/features/integration/ektis-check";
import { useL } from "@/lib/i18n";

function ProfileView() {
  const params = useSearchParams();
  const L = useL();
  const { data: profile, isLoading } = useProfile();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow={L("Kabinet", "Account")}
        title="Şəxsi məlumatlar"
        description={
          params.get("welcome")
            ? "Hesabınız yaradıldı. Şəxsiyyət məlumatlarınızı, büdcənizi və maraq sahələrinizi daxil edin."
            : "Göndərilmiş müraciətlər təqdim edildiyi andakı məlumatları saxlayır; buradakı dəyişikliklər onlara təsir etmir."
        }
      />
      <Panel>
        <PanelBody className="p-6">
          {isLoading ? (
            <Skeleton className="h-80" />
          ) : (
            <>
              {profile && <EktisCheck profile={profile} className="mb-5" />}
              <ProfileForm
                profile={profile}
                defaultCitizenship={parseCitizenship(params.get("citizenship"))}
                onSaved={() => toast.success(L("Məlumatlar yadda saxlanıldı", "Details saved"))} />
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
