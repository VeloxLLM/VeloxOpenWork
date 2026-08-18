/** @jsxImportSource react */
import { Button } from "@/components/ui/button";
import { ProviderIcon } from "../../../design-system/provider-icon";
import {
  LayoutSection,
  LayoutSectionDescription,
  LayoutSectionHeader,
  LayoutSectionItem,
  LayoutSectionItemHeader,
  LayoutSectionItemTitle,
  LayoutSectionTitle,
  LayoutStack,
} from "../settings-layout";
import { SettingsNotice, SettingsStatusBadge } from "../settings-section";
import { t } from "../../../../i18n";

type ConnectedProvider = {
  id: string;
  name: string;
  source?: "env" | "api" | "config" | "custom";
};

export type AiSettingsViewProps = {
  busy: boolean;
  providerAuthBusy: boolean;
  providerStatusLabel: string;
  providerSummary: string;
  connectedProviders: ConnectedProvider[];
  providerConnectError: string | null;
  providerDisconnectStatus: string | null;
  onOpenProviderAuth: () => void | Promise<void>;
  onDisconnectProvider: (providerId: string) => void | Promise<void>;
  canDisconnectProvider: (provider: ConnectedProvider) => boolean;
  canAddProviders: boolean;
};

export function AiSettingsView(props: AiSettingsViewProps) {
  const connected = props.providerStatusLabel.toLowerCase().includes("connected");

  return (
    <LayoutStack>
      <LayoutSection>
        <LayoutSectionHeader>
          <LayoutSectionTitle>{t("settings.ai.providers_title")}</LayoutSectionTitle>
          <LayoutSectionDescription>
            {t("settings.ai.providers_description")}
          </LayoutSectionDescription>
        </LayoutSectionHeader>
        <LayoutSectionItem>
          <LayoutSectionItemHeader>
            <LayoutSectionItemTitle>
              {props.providerSummary}
              <SettingsStatusBadge tone={connected ? "ready" : "neutral"} label={props.providerStatusLabel} />
            </LayoutSectionItemTitle>
            {props.canAddProviders ? (
              <Button onClick={() => void props.onOpenProviderAuth()} disabled={props.busy || props.providerAuthBusy}>
                {props.providerAuthBusy ? t("common.loading") : t("settings.ai.add_provider")}
              </Button>
            ) : null}
          </LayoutSectionItemHeader>
        </LayoutSectionItem>

        {props.connectedProviders.length > 0 ? (
          <div className="space-y-2">
            {props.connectedProviders.map((provider) => (
              <LayoutSectionItem
                key={provider.id}
                className="flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border border-dls-border px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ProviderIcon providerId={provider.id} providerName={provider.name} size={20} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-dls-text">{provider.name}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{provider.id}</div>
                  </div>
                </div>
                {props.canDisconnectProvider(provider) ? (
                  <Button
                    variant="destructive"
                    onClick={() => void props.onDisconnectProvider(provider.id)}
                    disabled={props.busy || props.providerAuthBusy}
                  >
                    {t("settings.ai.disconnect")}
                  </Button>
                ) : null}
              </LayoutSectionItem>
            ))}
          </div>
        ) : (
          <SettingsNotice>{t("settings.ai.empty")}</SettingsNotice>
        )}

        {props.providerConnectError ? <SettingsNotice tone="error">{props.providerConnectError}</SettingsNotice> : null}
        {props.providerDisconnectStatus ? <SettingsNotice>{props.providerDisconnectStatus}</SettingsNotice> : null}
        <p className="text-xs text-muted-foreground">{t("settings.api_keys_info")}</p>
      </LayoutSection>
    </LayoutStack>
  );
}
