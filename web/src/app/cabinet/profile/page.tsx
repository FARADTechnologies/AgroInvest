"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

import { Panel, PanelBody, Skeleton } from "@/components/ui/panel";
import { useProfile } from "@/features/applications/api";
import { ProfileForm } from "@/features/applications/profile-form";
import { EktisCheck } from "@/features/integration/ektis-check";

function ProfileView() {
  const params = useSearchParams();
  const { data: profile, isLoading } = useProfile();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl">Sahibkar məlumatları</h1>
        <p className="mt-1 text-sm text-ink-2">
          {params.get("welcome")
            ? "Hesabınız yaradıldı. Müraciət etmək üçün fiziki və ya hüquqi şəxs məlumatlarını daxil edin."
            : "Göndərilmiş müraciətlər təqdim edildiyi andakı məlumatları saxlayır; buradakı dəyişikliklər onlara təsir etmir."}
        </p>
      </div>
      <Panel>
        <PanelBody className="p-5">
          {isLoading ? (
            <Skeleton className="h-80" />
          ) : (
            <>
              {profile && <EktisCheck profile={profile} className="mb-5" />}
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
