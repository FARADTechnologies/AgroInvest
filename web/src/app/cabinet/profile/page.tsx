"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

import { Panel, PanelBody, Skeleton } from "@/components/ui/panel";
import { useProfile } from "@/features/applications/api";
import { ProfileForm } from "@/features/applications/profile-form";
import { useSession } from "@/features/auth/use-session";
import { EktisCheck } from "@/features/integration/ektis-check";

function ProfileView() {
  const params = useSearchParams();
  const { data: profile, isLoading } = useProfile();
  const { data: user } = useSession();
  const investor = user?.role === "INVESTOR";
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl">{investor ? "İnvestor məlumatları" : "Sahibkar məlumatları"}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {params.get("welcome")
            ? investor
              ? "Hesabınız yaradıldı. Şəxs məlumatlarını, büdcənizi və maraq sahələrinizi daxil edin."
              : "Hesabınız yaradıldı. Elan yerləşdirmək üçün fiziki və ya hüquqi şəxs məlumatlarını daxil edin."
            : investor
              ? "Göndərilmiş müraciətlər təqdim edildiyi andakı məlumatları saxlayır; buradakı dəyişikliklər onlara təsir etmir."
              : "Bu məlumatlar elanlarınızda elan sahibi kimi istifadə olunur."}
        </p>
      </div>
      <Panel>
        <PanelBody className="p-5">
          {isLoading ? (
            <Skeleton className="h-80" />
          ) : (
            <>
              {profile && investor && <EktisCheck profile={profile} className="mb-5" />}
              <ProfileForm profile={profile} onSaved={() => toast.success("Məlumatlar yadda saxlanıldı")} />
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
