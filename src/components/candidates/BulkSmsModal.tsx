import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  createSmsBulkTemplate,
  deleteSmsBulkTemplate,
  getSmsBulkCatalog,
  getSmsBulkTemplates,
  previewSmsBulkTemplate,
  sendSmsBulk,
  updateSmsBulkTemplate,
  type SmsBulkTemplateResponse,
  type SmsTemplateVariableResponse,
} from "../../lib/institution-settings-api";
import { useT } from "../../lib/i18n";
import { isAbortError } from "../../lib/http";
import { Modal } from "../ui/Modal";

type BulkSmsModalProps = {
  candidateIds: string[];
  onClose: () => void;
  onSent: (queuedCount: number, skippedCount: number) => void;
  open: boolean;
};

const defaultBulkSmsVariables: SmsTemplateVariableResponse[] = [
  {
    key: "candidate.fullName",
    label: "Aday adı soyadı",
    exampleValue: "Ayşe Yılmaz",
  },
  {
    key: "institution.name",
    label: "Kurum adı",
    exampleValue: "Örnek Sürücü Kursu",
  },
];

export function BulkSmsModal({ candidateIds, onClose, onSent, open }: BulkSmsModalProps) {
  const t = useT();
  const templateId = useId();
  const templateNameId = useId();
  const messageId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [templates, setTemplates] = useState<SmsBulkTemplateResponse[]>([]);
  const [variables, setVariables] = useState<SmsTemplateVariableResponse[]>(defaultBulkSmsVariables);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sendRequestId, setSendRequestId] = useState("");

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates]
  );

  useEffect(() => {
    if (!open) return;
    setSendRequestId(crypto.randomUUID());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([getSmsBulkTemplates(controller.signal), getSmsBulkCatalog(controller.signal)])
      .then(([nextTemplates, catalog]) => {
        setTemplates(nextTemplates);
        setVariables(catalog.variables.length > 0 ? catalog.variables : defaultBulkSmsVariables);
        const first = nextTemplates[0];
        setSelectedId(first?.id ?? "");
        setName(first?.name ?? "");
        setBody(first?.body ?? "");
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted || isAbortError(loadError)) return;
        setError(t("candidates.bulkSms.loadError"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, t]);

  useEffect(() => {
    if (!body.trim()) {
      setPreview("");
      return;
    }
    const timer = window.setTimeout(() => {
      previewSmsBulkTemplate(name || "Preview", body)
        .then((result) => setPreview(result.renderedBody))
        .catch(() => setPreview(""));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [body, name]);

  const selectTemplate = (templateId: string) => {
    setSelectedId(templateId);
    const template = templates.find((item) => item.id === templateId);
    setName(template?.name ?? "");
    setBody(template?.body ?? "");
    setError("");
    setSendRequestId(crypto.randomUUID());
  };

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${token}${body.slice(end)}`);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const saveTemplate = async () => {
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    setError("");
    try {
      const saved = selected
        ? await updateSmsBulkTemplate(selected.id, name, body, selected.rowVersion)
        : await createSmsBulkTemplate(name, body);
      setTemplates((current) => [...current.filter((item) => item.id !== saved.id), saved]
        .sort((left, right) => left.name.localeCompare(right.name)));
      setSelectedId(saved.id);
      setSendRequestId(crypto.randomUUID());
    } catch {
      setError(t("candidates.bulkSms.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async () => {
    if (!selected || !window.confirm(t("candidates.bulkSms.deleteConfirm"))) return;
    setSaving(true);
    setError("");
    try {
      await deleteSmsBulkTemplate(selected.id, selected.rowVersion);
      const remaining = templates.filter((item) => item.id !== selected.id);
      const first = remaining[0];
      setTemplates(remaining);
      setSelectedId(first?.id ?? "");
      setName(first?.name ?? "");
      setBody(first?.body ?? "");
      setSendRequestId(crypto.randomUUID());
    } catch {
      setError(t("candidates.bulkSms.deleteError"));
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    if (!selected || selected.name !== name.trim() || selected.body !== body.trim()) {
      setError(t("candidates.bulkSms.saveBeforeSend"));
      return;
    }
    setSending(true);
    setError("");
    try {
      const result = await sendSmsBulk(candidateIds, selected.id, sendRequestId);
      onSent(result.queuedCount, result.skippedCount);
    } catch {
      setError(t("candidates.bulkSms.sendError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" disabled={sending} onClick={onClose} type="button">
            {t("candidates.bulk.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={!selected || !sendRequestId || candidateIds.length === 0 || sending || saving}
            onClick={send}
            type="button"
          >
            {sending ? t("candidates.bulkSms.sending") : t("candidates.bulkSms.send")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={t("candidates.bulkSms.title", { count: candidateIds.length })}
    >
      <div className="bulk-sms-modal">
        {loading ? <div className="settings-loading">{t("common.loading")}</div> : (
          <>
            <div className="form-row bulk-sms-template-row">
              <div className="form-group">
                <label className="form-label" htmlFor={templateId}>{t("candidates.bulkSms.template")}</label>
                <select className="form-select" id={templateId} onChange={(event) => selectTemplate(event.target.value)} value={selectedId}>
                  <option value="">{t("candidates.bulkSms.newTemplate")}</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={templateNameId}>{t("candidates.bulkSms.templateName")}</label>
                <input className="form-input" id={templateNameId} maxLength={120} onChange={(event) => setName(event.target.value)} value={name} />
              </div>
            </div>
            <div className="form-group bulk-sms-message-field">
              <label className="form-label" htmlFor={messageId}>{t("candidates.bulkSms.message")}</label>
              <div className="sms-template-editor">
                <div className="sms-template-editor-compose">
                <textarea
                  aria-label={t("candidates.bulkSms.message")}
                  className="sms-template-editor-input"
                  id={messageId}
                  maxLength={1000}
                  onChange={(event) => setBody(event.target.value)}
                  ref={textareaRef}
                  rows={7}
                  value={body}
                />
                  <div className="sms-template-editor-footer"><span>{body.length}/1000</span></div>
                </div>
                <aside aria-label={t("candidates.bulkSms.variables")} className="sms-template-editor-variables">
                  <div className="sms-template-editor-variables-header">
                    <strong>{t("candidates.bulkSms.variables")}</strong>
                    <span>{t("candidates.bulkSms.variablesHint")}</span>
                  </div>
                  <div className="sms-template-editor-variable-list">
                    {variables.map((variable) => (
                      <button
                        className="sms-template-editor-variable"
                        key={variable.key}
                        onClick={() => insertVariable(variable.key)}
                        onMouseDown={(event) => event.preventDefault()}
                        title={variable.exampleValue}
                        type="button"
                      >
                        <span>{variable.label}</span><code>{`{{${variable.key}}}`}</code>
                      </button>
                    ))}
                  </div>
                </aside>
              </div>
            </div>
            <div className="bulk-sms-template-actions">
              <button className="btn btn-secondary btn-sm" disabled={!name.trim() || !body.trim() || saving} onClick={saveTemplate} type="button">
                {saving ? t("common.saving") : t("candidates.bulkSms.saveTemplate")}
              </button>
              {selected ? <button className="btn btn-danger btn-sm" disabled={saving} onClick={removeTemplate} type="button">{t("common.delete")}</button> : null}
            </div>
            <div className="bulk-sms-preview">
              <strong>{t("candidates.bulkSms.preview")}</strong>
              <p>{preview || "—"}</p>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
          </>
        )}
      </div>
    </Modal>
  );
}
