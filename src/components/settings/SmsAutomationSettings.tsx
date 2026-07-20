import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../lib/auth";
import { useT } from "../../lib/i18n";
import {
  createSmsTemplate,
  getSmsAutomationRules,
  getSmsTemplates,
  getSmsTriggerCatalog,
  previewSmsTemplate,
  updateSmsTemplate,
  upsertSmsAutomationRule,
  type SmsTemplateVariableResponse,
  type SmsTemplatePreviewResponse,
} from "../../lib/institution-settings-api";
import { CustomSelect } from "../ui/CustomSelect";
import { SettingsFormSkeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";

const CACHE_MS = 5 * 60 * 1000;

type RuleDraft = {
  templateId: string;
  enabled: boolean;
};

type Props = {
  canManage: boolean;
  noPermissionTitle: string;
  section: "account" | "automation";
};

export function SmsAutomationSettings({ canManage, noPermissionTitle, section }: Props) {
  const t = useT();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { activeInstitution } = useAuth();
  const institutionKey = activeInstitution?.id ?? "none";
  const queryPrefix = ["settings", "sms-automation", institutionKey] as const;
  const catalogQuery = useQuery({
    gcTime: CACHE_MS,
    queryKey: [...queryPrefix, "catalog"],
    queryFn: ({ signal }) => getSmsTriggerCatalog(signal),
    retry: false,
  });
  const templatesQuery = useQuery({
    gcTime: CACHE_MS,
    queryKey: [...queryPrefix, "templates"],
    queryFn: ({ signal }) => getSmsTemplates(signal),
    retry: false,
  });
  const rulesQuery = useQuery({
    gcTime: CACHE_MS,
    queryKey: [...queryPrefix, "rules"],
    queryFn: ({ signal }) => getSmsAutomationRules(signal),
    retry: false,
  });

  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [preview, setPreview] = useState<SmsTemplatePreviewResponse | null>(null);
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, RuleDraft>>({});
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const rules = useMemo(() => rulesQuery.data ?? [], [rulesQuery.data]);
  const effectiveSelectedTrigger = selectedTrigger || catalog[0]?.triggerType || "";
  const currentTrigger = catalog.find((item) => item.triggerType === effectiveSelectedTrigger) ?? null;
  const currentTemplate = templates.find((item) => item.triggerType === effectiveSelectedTrigger) ?? null;

  useEffect(() => {
    setTemplateBody(currentTemplate?.body ?? "");
    setPreview(null);
  }, [currentTemplate, effectiveSelectedTrigger]);

  useEffect(() => {
    if (catalog.length === 0) return;
    setRuleDrafts((current) => {
      const next = { ...current };
      for (const trigger of catalog) {
        const rule = rules.find((item) => item.triggerType === trigger.triggerType);
        const template = templates.find((item) => item.triggerType === trigger.triggerType);
        next[trigger.triggerType] = {
          templateId: template?.id ?? "",
          enabled: rule?.enabled ?? false,
        };
      }
      return next;
    });
  }, [catalog, rules, templates]);

  useEffect(() => {
    if (catalogQuery.isError || templatesQuery.isError || rulesQuery.isError) {
      showToast(t("settings.integrations.sms.automation.loadError"), "error");
    }
  }, [catalogQuery.isError, rulesQuery.isError, showToast, t, templatesQuery.isError]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [...queryPrefix, "templates"] }),
      queryClient.invalidateQueries({ queryKey: [...queryPrefix, "rules"] }),
    ]);
  };

  const handleAutomaticSave = async () => {
    if (!effectiveSelectedTrigger || !currentTrigger || !templateBody.trim()) {
      showToast(t("settings.integrations.sms.automation.templateRequired"), "error");
      return;
    }

    const draft = ruleDrafts[effectiveSelectedTrigger] ?? {
      templateId: currentTemplate?.id ?? "",
      enabled: false,
    };
    const currentRule = rules.find((item) => item.triggerType === effectiveSelectedTrigger);
    setSaving(true);
    try {
      const body = {
        triggerType: effectiveSelectedTrigger,
        name: getTriggerTitle(currentTrigger.triggerType, currentTrigger.title, t),
        body: templateBody.trim(),
        enabled: true,
        rowVersion: currentTemplate?.rowVersion ?? null,
      };
      const saved = currentTemplate
        ? await updateSmsTemplate(currentTemplate.id, body)
        : await createSmsTemplate(body);
      await upsertSmsAutomationRule(effectiveSelectedTrigger, {
        templateId: saved.id,
        timingType: "immediate",
        offsetMinutes: null,
        enabled: draft.enabled,
        rowVersion: currentRule?.rowVersion ?? null,
      });
      await refresh();
      setTemplateBody(saved.body);
      showToast(t("settings.integrations.sms.automation.automaticSaved"));
    } catch {
      showToast(t("settings.integrations.sms.automation.automaticSaveError"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!effectiveSelectedTrigger || !templateBody.trim()) return;
    setPreviewing(true);
    try {
      setPreview(await previewSmsTemplate(effectiveSelectedTrigger, templateBody.trim()));
    } catch {
      showToast(t("settings.integrations.sms.automation.previewError"), "error");
    } finally {
      setPreviewing(false);
    }
  };

  if (section === "account") {
    return null;
  }

  if (catalogQuery.isLoading || templatesQuery.isLoading || rulesQuery.isLoading) {
    return <SettingsFormSkeleton rows={6} />;
  }

  const draft = ruleDrafts[effectiveSelectedTrigger] ?? {
    templateId: currentTemplate?.id ?? "",
    enabled: false,
  };
  const activationAvailable = effectiveSelectedTrigger === "candidate.created";

  return (
    <section className="settings-surface">
      <div className="settings-surface-header">
        <div>
          <h2 className="settings-surface-title">
            {t("settings.integrations.sms.automation.rulesTitle")}
          </h2>
          <p className="settings-form-helper">
            {t("settings.integrations.sms.automation.combinedDescription")}
          </p>
        </div>
      </div>
      <div className="settings-surface-body">
        <div className="settings-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="sms-template-trigger">
                {t("settings.integrations.sms.automation.trigger")}
              </label>
              <CustomSelect
                className="form-select"
                disabled={!canManage}
                id="sms-template-trigger"
                onChange={(event) => setSelectedTrigger(event.target.value)}
                value={effectiveSelectedTrigger}
              >
                {catalog.map((trigger) => (
                  <option key={trigger.triggerType} value={trigger.triggerType}>
                    {getTriggerTitle(trigger.triggerType, trigger.title, t)}
                  </option>
                ))}
              </CustomSelect>
              {currentTrigger ? (
                <span className="settings-form-helper">
                  {getTriggerDescription(currentTrigger.triggerType, currentTrigger.description, t)}
                </span>
              ) : null}
            </div>
            <div className="form-group">
              <span className="form-label">
                {t("settings.integrations.sms.status")}
              </span>
              <label className="switch-toggle settings-inline-status-toggle">
                <input
                  checked={draft.enabled}
                  disabled={!canManage || !activationAvailable}
                  onChange={(event) =>
                    setRuleDrafts((current) => ({
                      ...current,
                      [effectiveSelectedTrigger]: {
                        ...draft,
                        enabled: event.target.checked,
                      },
                    }))
                  }
                  type="checkbox"
                />
                <span aria-hidden="true" className="switch-toggle-control" />
                <span>
                  {draft.enabled
                    ? t("settings.integrations.sms.automation.automaticActive")
                    : t("settings.integrations.sms.automation.automaticPassive")}
                </span>
              </label>
              {!activationAvailable ? (
                <span className="settings-form-helper">
                  {t("settings.integrations.sms.automation.triggerLocked")}
                </span>
              ) : null}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sms-template-body">
              {t("settings.integrations.sms.automation.message")}
            </label>
            <SmsTemplateEditor
              disabled={!canManage}
              id="sms-template-body"
              maxLength={1000}
              onChange={(value) => {
                setTemplateBody(value);
                setPreview(null);
              }}
              value={templateBody}
              variables={currentTrigger?.variables ?? []}
            />
          </div>
          {preview ? (
            <div className="settings-panel-note">
              <strong>{t("settings.integrations.sms.automation.preview")}</strong>
              <p>{preview.renderedBody}</p>
              <span>
                {t("settings.integrations.sms.automation.previewMeta", {
                  characters: preview.characterCount,
                  segments: preview.estimatedSegmentCount,
                })}
              </span>
            </div>
          ) : null}
          <div className="settings-form-actions">
            <button
              className="btn btn-secondary btn-sm"
              disabled={!templateBody.trim() || previewing}
              onClick={() => void handlePreview()}
              type="button"
            >
              {previewing
                ? t("settings.integrations.sms.automation.previewing")
                : t("settings.integrations.sms.automation.preview")}
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!canManage || saving || !templateBody.trim()}
              onClick={() => void handleAutomaticSave()}
              title={!canManage ? noPermissionTitle : undefined}
              type="button"
            >
              {saving ? t("settings.toolbar.saving") : t("settings.toolbar.save")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

type SmsTemplateEditorProps = {
  disabled: boolean;
  id: string;
  maxLength: number;
  onChange: (value: string) => void;
  value: string;
  variables: SmsTemplateVariableResponse[];
};

function SmsTemplateEditor({
  disabled,
  id,
  maxLength,
  onChange,
  value,
  variables,
}: SmsTemplateEditorProps) {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (key: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    const token = `{{${key}}}`;
    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`.slice(0, maxLength);
    const nextCursor = Math.min(start + token.length, nextValue.length);
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div className={`sms-template-editor${disabled ? " is-disabled" : ""}`}>
      <div className="sms-template-editor-compose">
        <textarea
          className="sms-template-editor-input"
          disabled={disabled}
          id={id}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          ref={textareaRef}
          rows={7}
          value={value}
        />
        <div className="sms-template-editor-footer">
          <span>{value.length}/{maxLength}</span>
        </div>
      </div>
      <aside
        aria-label={t("settings.integrations.sms.automation.variables")}
        className="sms-template-editor-variables"
      >
        <div className="sms-template-editor-variables-header">
          <strong>{t("settings.integrations.sms.automation.variables")}</strong>
          <span>{t("settings.integrations.sms.automation.variablesHint")}</span>
        </div>
        <div className="sms-template-editor-variable-list">
          {variables.map((variable) => (
            <button
              aria-label={getVariableLabel(variable.key, variable.label, t)}
              className="sms-template-editor-variable"
              disabled={disabled}
              key={variable.key}
              onClick={() => insertVariable(variable.key)}
              onMouseDown={(event) => event.preventDefault()}
              title={variable.exampleValue}
              type="button"
            >
              <span>{getVariableLabel(variable.key, variable.label, t)}</span>
              <code>{`{{${variable.key}}}`}</code>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

type Translate = ReturnType<typeof useT>;

function getTriggerTitle(triggerType: string, fallback: string, t: Translate): string {
  switch (triggerType) {
    case "candidate.created":
      return t("settings.integrations.sms.automation.trigger.candidateCreated");
    case "finance.debt.created":
      return t("settings.integrations.sms.automation.trigger.debtCreated");
    default:
      return fallback;
  }
}

function getTriggerDescription(triggerType: string, fallback: string, t: Translate): string {
  switch (triggerType) {
    case "candidate.created":
      return t("settings.integrations.sms.automation.trigger.candidateCreatedDescription");
    case "finance.debt.created":
      return t("settings.integrations.sms.automation.trigger.debtCreatedDescription");
    default:
      return fallback;
  }
}

function getVariableLabel(key: string, fallback: string, t: Translate): string {
  switch (key) {
    case "institution.name":
      return t("settings.integrations.sms.automation.variable.institutionName");
    case "candidate.fullName":
      return t("settings.integrations.sms.automation.variable.candidateFullName");
    case "debt.amount":
      return t("settings.integrations.sms.automation.variable.debtAmount");
    case "debt.dueDate":
      return t("settings.integrations.sms.automation.variable.debtDueDate");
    case "debt.type":
      return t("settings.integrations.sms.automation.variable.debtType");
    default:
      return fallback;
  }
}
