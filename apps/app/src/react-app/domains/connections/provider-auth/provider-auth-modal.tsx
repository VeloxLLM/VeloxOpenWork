/** @jsxImportSource react */
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OPTIONAL_PROVIDER_PRESETS, type ProviderPreset } from "@/app/provider-catalog";
import { currentLocale, t } from "@/i18n";
import { TextInput } from "../../../design-system/text-input";

export type ManualProviderInput = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelIds: string[];
  proxyUrl: string;
  proxyUsername: string;
  proxyPassword: string;
  proxyEnabled: boolean;
  defaultModelId: string;
};

export type ProviderAuthModalProps = {
  open: boolean;
  loading?: boolean;
  submitting?: boolean;
  error?: string | null;
  initialProvider?: Partial<ManualProviderInput> | null;
  onSubmitManual?: (input: ManualProviderInput) => Promise<void>;
  onTestConnection?: (input: ManualProviderInput) => Promise<string>;
  onClose: () => void;
  [key: string]: unknown;
};

export default function ProviderAuthModal({
  open,
  loading = false,
  submitting = false,
  error,
  initialProvider,
  onSubmitManual,
  onTestConnection,
  onClose,
}: ProviderAuthModalProps) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [proxyUsername, setProxyUsername] = useState("");
  const [proxyPassword, setProxyPassword] = useState("");
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [defaultModelId, setDefaultModelId] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setId(initialProvider?.id ?? "");
    setName(initialProvider?.name ?? "");
    setBaseUrl(initialProvider?.baseUrl ?? "");
    setApiKey("");
    setModels(initialProvider?.modelIds?.join("\n") ?? "");
    setProxyUrl(initialProvider?.proxyUrl ?? "");
    setProxyUsername(initialProvider?.proxyUsername ?? "");
    setProxyPassword("");
    setProxyEnabled(initialProvider?.proxyEnabled ?? Boolean(initialProvider?.proxyUrl));
    setDefaultModelId(initialProvider?.defaultModelId ?? initialProvider?.modelIds?.[0] ?? "");
    setLocalError(null);
  }, [open, initialProvider]);

  async function submit() {
    const modelIds = models.split(/[\n,]/).map((model) => model.trim()).filter(Boolean);
    if (!id.trim() || !name.trim() || !baseUrl.trim() || modelIds.length === 0) {
      setLocalError(t("providers.manual_required"));
      return;
    }
    if (!onSubmitManual) return;
    setLocalError(null);
    try {
      await onSubmitManual({
        id: id.trim(),
        name: name.trim(),
        baseUrl: baseUrl.trim().replace(/\/$/, ""),
        apiKey,
        modelIds,
        proxyUrl: proxyUrl.trim(),
        proxyUsername: proxyUsername.trim(),
        proxyPassword,
        proxyEnabled,
        defaultModelId: defaultModelId || modelIds[0],
      });
      onClose();
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : t("providers.manual_save_failed"));
    }
  }

  async function testConnection() {
    const modelIds = models.split(/[\n,]/).map((model) => model.trim()).filter(Boolean);
    if (!id.trim() || !baseUrl.trim()) {
      setLocalError(t("providers.manual_test_required"));
      return;
    }
    if (!onTestConnection) return;
    setLocalError(null);
    try {
      const message = await onTestConnection({
        id: id.trim(),
        name: name.trim() || id.trim(),
        baseUrl: baseUrl.trim().replace(/\/$/, ""),
        apiKey,
        modelIds,
        proxyUrl: proxyUrl.trim(),
        proxyUsername: proxyUsername.trim(),
        proxyPassword,
        proxyEnabled,
        defaultModelId: defaultModelId || modelIds[0] || "",
      });
      setLocalError(message || t("providers.manual_test_success"));
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : t("providers.manual_test_failed"));
    }
  }

  function applyPreset(preset: ProviderPreset) {
    setId(preset.id);
    setName(preset.name);
    setBaseUrl(preset.baseUrl);
    setModels(preset.modelIds.join("\n"));
    setDefaultModelId(preset.modelIds[0] ?? "");
    setLocalError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !submitting) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialProvider?.id ? t("providers.manual_edit_title") : t("providers.manual_add_title")}</DialogTitle>
          <DialogDescription>
            {t("providers.manual_description")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {!initialProvider?.id ? (
            <div className="grid gap-2">
              <span className="text-sm font-medium">{t("providers.optional_templates")}</span>
              <div className="flex flex-wrap gap-2">
                {OPTIONAL_PROVIDER_PRESETS.map((preset) => (
                  <Button key={preset.id} type="button" variant="outline" onClick={() => applyPreset(preset)}>
                    {preset.name}
                  </Button>
                ))}
              </div>
              {OPTIONAL_PROVIDER_PRESETS.find((preset) => preset.id === id) ? (
                <p className="text-xs text-muted-foreground">
                  {currentLocale() === "zh"
                    ? OPTIONAL_PROVIDER_PRESETS.find((preset) => preset.id === id)?.description
                    : OPTIONAL_PROVIDER_PRESETS.find((preset) => preset.id === id)?.descriptionEn}
                </p>
              ) : null}
            </div>
          ) : null}
          <TextInput label="Provider ID" value={id} onChange={(event) => setId(event.target.value)} placeholder="openai" disabled={loading || submitting || Boolean(initialProvider?.id)} />
          <TextInput label={t("providers.manual_name")} value={name} onChange={(event) => setName(event.target.value)} placeholder="OpenAI" disabled={loading || submitting} />
          <TextInput label="Base URL" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" disabled={loading || submitting} />
          <TextInput label="API Key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={t("providers.manual_secret_placeholder")} disabled={loading || submitting} />
          <TextInput label="Model ID" value={models} onChange={(event) => setModels(event.target.value)} placeholder={t("providers.manual_models_placeholder")} disabled={loading || submitting} />
          <TextInput label={t("providers.manual_default_model")} value={defaultModelId} onChange={(event) => setDefaultModelId(event.target.value)} placeholder={t("providers.manual_default_model_placeholder")} disabled={loading || submitting} />
          <label className="mt-2 flex items-center gap-2 border-t border-dls-border pt-3 text-sm font-medium">
            <input type="checkbox" checked={proxyEnabled} onChange={(event) => setProxyEnabled(event.target.checked)} disabled={loading || submitting} />
            {t("providers.manual_proxy_enable")}
          </label>
          {proxyEnabled ? (
            <>
              <TextInput label="Proxy URL" value={proxyUrl} onChange={(event) => setProxyUrl(event.target.value)} placeholder="http://127.0.0.1:2080" disabled={loading || submitting} />
              <TextInput label="Proxy Username" value={proxyUsername} onChange={(event) => setProxyUsername(event.target.value)} placeholder={t("common.optional")} disabled={loading || submitting} />
              <TextInput label="Proxy Password" type="password" value={proxyPassword} onChange={(event) => setProxyPassword(event.target.value)} placeholder={t("providers.manual_secret_placeholder")} disabled={loading || submitting} />
              <Button type="button" variant="ghost" onClick={() => { setProxyUrl(""); setProxyUsername(""); setProxyPassword(""); setProxyEnabled(false); }}>
                {t("providers.manual_proxy_clear")}
              </Button>
            </>
          ) : null}
          <p className="text-xs text-muted-foreground">{t("providers.manual_proxy_hint")}</p>
          {localError || error ? <p className="text-sm text-destructive">{localError ?? error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>{t("common.cancel")}</Button>
          <Button variant="outline" onClick={() => void testConnection()} disabled={loading || submitting || !onTestConnection}>{t("providers.manual_test")}</Button>
          <Button onClick={() => void submit()} disabled={loading || submitting}>
            {submitting ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
