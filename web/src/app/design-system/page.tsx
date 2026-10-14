"use client";

import { PurposeChip } from "@/components/domain/purpose-chip";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { FAO_CLASSES, PURPOSES } from "@/lib/domain";
import { useT } from "@/lib/i18n";

// Living style guide: every token and shared component on one page, used for
// visual QA and as the reference when the UI is restyled.

const SWATCHES = [
  ["bg", "bg-bg"],
  ["surface", "bg-surface"],
  ["surface-2", "bg-surface-2"],
  ["border", "bg-border"],
  ["primary", "bg-primary"],
  ["primary-50", "bg-primary-50"],
  ["accent", "bg-accent"],
  ["danger", "bg-danger"],
  ["text", "bg-ink"],
  ["text-2", "bg-ink-2"]
] as const;

const SUIT = { S1: "bg-suit-s1", S2: "bg-suit-s2", S3: "bg-suit-s3", N: "bg-suit-n" } as const;

export default function DesignSystemPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl">Dizayn sistemi</h1>
        <p className="mt-1 text-ink-2">Tokenlər və ortaq komponentlər.</p>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Şrift: IBM Plex Sans / Mono</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2">
          <p className="text-3xl font-semibold">Əkinçilik, heyvandarlıq və bağçılıq</p>
          <p className="text-15">
            Şuşa, Ağdam, Füzuli, Cəbrayıl, Qubadlı, Laçın, Kəlbəcər, Zəngilan, Xocalı, Xocavənd, Xankəndi
          </p>
          <p className="text-15">ƏĞİÖÜÇŞ əğıöüçş · İstifadə şərtləri · Son müraciət tarixi</p>
          <p className="font-mono text-sm">QIM-2026-000123 · VÖEN 14•••••21 · 42,6 ha · 850 000 AZN</p>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Rənglər</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid grid-cols-5 gap-3">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="space-y-1">
              <div className={`h-10 rounded-md border border-border ${cls}`} />
              <div className="font-mono text-2xs text-ink-2">{name}</div>
            </div>
          ))}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Müraciət statusları</PanelTitle>
        </PanelHeader>
        <PanelBody className="flex flex-wrap gap-2">
          <StatusBadge status="DRAFT" />
          <StatusBadge status="RECEIVED" />
          <StatusBadge status="UNDER_REVIEW" />
          <StatusBadge status="INFO_REQUESTED" />
          <StatusBadge status="DECIDED" outcome="WON" />
          <StatusBadge status="DECIDED" outcome="REJECTED" />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Təyinat və uyğunluq</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PURPOSES.map((p, i) => (
              <PurposeChip key={p} purpose={p} count={[54, 31, 28, 9][i]} selected={i === 0} onToggle={() => {}} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {FAO_CLASSES.map((c) => (
              <span key={c} className="inline-flex items-center gap-2 text-13">
                <span className={`size-3 rounded-[2px] ${SUIT[c]}`} />
                <span className="font-mono">{c}</span> {t.suitability[c]}
              </span>
            ))}
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Düymələr və sahələr</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>Müraciət et</Button>
            <Button variant="secondary">Müqayisəyə əlavə et</Button>
            <Button variant="ghost">Ləğv et</Button>
            <Button variant="danger">İmtina</Button>
            <Button variant="link">Ətraflı</Button>
          </div>
          <div className="grid max-w-md gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ds-amount">İnvestisiya məbləği (AZN)</Label>
              <Input id="ds-amount" placeholder="850 000" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ds-summary">Layihənin qısa təsviri</Label>
              <Textarea id="ds-summary" placeholder="Məhsul, bazar, texnologiya…" />
            </div>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
