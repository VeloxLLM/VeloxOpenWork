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
import { TextInput } from "../../../design-system/text-input";

export type ManualProviderInput = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelIds: string[];
};

export type ProviderAuthModalProps = {
  open: boolean;
  loading?: boolean;
  submitting?: boolean;
  error?: string | null;
  initialProvider?: Partial<ManualProviderInput> | null;
  onSubmitManual?: (input: ManualProviderInput) => Promise<void>;
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
  onClose,
}: ProviderAuthModalProps) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setId(initialProvider?.id ?? "");
    setName(initialProvider?.name ?? "");
    setBaseUrl(initialProvider?.baseUrl ?? "");
    setApiKey("");
    setModels(initialProvider?.modelIds?.join("\n") ?? "");
    setLocalError(null);
  }, [open, initialProvider]);

  async function submit() {
    const modelIds = models.split(/[\n,]/).map((model) => model.trim()).filter(Boolean);
    if (!id.trim() || !name.trim() || !baseUrl.trim() || modelIds.length === 0) {
      setLocalError("Provider ID, name, Base URL, and at least one Model ID are required.");
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
      });
      onClose();
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Unable to save provider.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !submitting) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加模型提供商</DialogTitle>
          <DialogDescription>
            手动配置本地 provider。API Key 将使用系统安全存储加密，不写入普通 OpenCode 配置文件。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <TextInput label="Provider ID" value={id} onChange={(event) => setId(event.target.value)} placeholder="openai" disabled={loading || submitting} />
          <TextInput label="Provider 名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="OpenAI" disabled={loading || submitting} />
          <TextInput label="Base URL" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" disabled={loading || submitting} />
          <TextInput label="API Key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="留空表示保留已有密钥" disabled={loading || submitting} />
          <TextInput label="Model ID" value={models} onChange={(event) => setModels(event.target.value)} placeholder="每行或逗号分隔，例如 gpt-4o-mini" disabled={loading || submitting} />
          {localError || error ? <p className="text-sm text-destructive">{localError ?? error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>取消</Button>
          <Button onClick={() => void submit()} disabled={loading || submitting}>
            {submitting ? "保存中..." : "保存 provider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
