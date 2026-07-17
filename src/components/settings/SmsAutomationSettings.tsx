import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../lib/auth";
import { useT } from "../../lib/i18n";
import {
  createSmsTemplate,
  deleteSmsTemplate,
  getSmsAutomationRules,
  getSmsTemplates,
  getSmsTriggerCatalog,
  previewSmsTemplate,
  updateSmsTemplate,
  upsertSmsAutomationRule,
  type SmsAutomationRuleResponse,
  type SmsTemplateVariableResponse,
  type SmsTemplatePreviewResponse,
  type SmsTemplateResponse,
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
  section: "account" | "templates" | "automation";
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
  const [selectedTemplateId, setSelectedTemplateId] = useState("new");
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateEnabled, setTemplateEnabled] = useState(true);
  const [preview, setPreview] = useState<SmsTemplatePreviewResponse | null>(null);
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, RuleDraft>>({});
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingRule, setSavingRule] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const rules = useMemo(() => rulesQuery.data ?? [], [rulesQuery.data]);
  const currentTrigger = catalog.find((item) => item.triggerType === selectedTrigger) ?? null;
  const currentTemplate = templates.find((item) => item.id === selectedTemplateId) ?? null;

  useEffect(() => {
    if (!selectedTrigger && catalog.length > 0) {
      setSelectedTrigger(catalog[0].triggerType);
    }
  }, [catalog, selectedTrigger]);

  useEffect(() => {
    if (selectedTemplateId === "new") {
      setTemplateName("");
      setTemplateBody("");
      setTemplateEnabled(true);
      setPreview(null);
      return;
    }
    if (currentTemplate) {
      setSelectedTrigger(currentTemplate.triggerType);
      setTemplateName(currentTemplate.name);
      setTemplateBody(currentTemplate.body);
      setTemplateEnabled(currentTemplate.enabled);
      setPreview(null);
    }
  }, [currentTemplate, selectedTemplateId]);

  useEffect(() => {
    if (catalog.length === 0) return;
    setRuleDrafts((current) => {
      const next = { ...current };
      for (const trigger of catalog) {
        const rule = rules.find((item) => item.triggerType === trigger.triggerType);
        const available = templates.filter(
          (item) => item.triggerType === trigger.triggerType && item.enabled,
        );
        next[trigger.triggerType] = {
          templateId: rule?.templateId ?? next[trigger.triggerType]?.templateId ?? available[0]?.id ?? "",
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

  const resetTemplateForm = () => {
    setSelectedTemplateId("new");
    setTemplateName("");
    setTemplateBody("");
    setTemplateEnabled(true);
    setPreview(null);
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [...queryPrefix, "templates"] }),
      queryClient.invalidateQueries({ queryKey: [...queryPrefix, "rules"] }),
    ]);
  };

  const handleTemplateSave = async () => {
    if (!selectedTrigger || !templateName.trim() || !templateBody.trim()) {
      showToast(t("settings.integrations.sms.automation.templateRequired"), "error");
      return;
    }

    setSavingTemplate(true);
    try {
      const body = {
        triggerType: selectedTrigger,
        name: templateName.trim(),
        body: templateBody.trim(),
        enabled: templateEnabled,
        rowVersion: currentTemplate?.rowVersion ?? null,
      };
      const saved = currentTemplate
        ? await updateSmsTemplate(currentTemplate.id, body)
        : await createSmsTemplate(body);
      await refresh();
      setSelectedTemplateId(saved.id);
      setTemplateName(saved.name);
      setTemplateBody(saved.body);
      setTemplateEnabled(saved.enabled);
      showToast(t("settings.integrations.sms.automation.templateSaved"));
    } catch {
      showToast(t("settings.integrations.sms.automation.templateSaveError"), "error");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedTrigger || !templateBody.trim()) return;
    setPreviewing(true);
    try {
      setPreview(await previewSmsTemplate(selectedTrigger, templateBody.trim()));
    } catch {
      showToast(t("settings.integrations.sms.automation.previewError"), "error");
    } finally {
      setPreviewing(false);
    }
  };

  const handleDelete = async () => {
    if (!currentTemplate || !window.confirm(t("settings.integrations.sms.automation.deleteConfirm"))) {
      return;
    }
    setDeleting(true);
    try {
      await deleteSmsTemplate(currentTemplate.id, currentTemplate.rowVersion);
      resetTemplateForm();
      await refresh();
      showToast(t("settings.integrations.sms.automation.templateDeleted"));
    } catch {
      showToast(t("settings.integrations.sms.automation.templateDeleteError"), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleRuleSave = async (triggerType: string) => {
    const draft = ruleDrafts[triggerType];
    if (!draft?.templateId) {
      showToast(t("settings.integrations.sms.automation.ruleTemplateRequired"), "error");
      return;
    }
    const currentRule = rules.find((item) => item.triggerType === triggerType);
    setSavingRule(triggerType);
    try {
      await upsertSmsAutomationRule(triggerType, {
        templateId: draft.templateId,
        timingType: "immediate",
        offsetMinutes: null,
        enabled: draft.enabled,
        rowVersion: currentRule?.rowVersion ?? null,
      });
      await refresh();
      showToast(t("settings.integrations.sms.automation.ruleSaved"));
    } catch {
      showToast(t("settings.integrations.sms.automation.ruleSaveError"), "error");
    } finally {
      setSavingRule(null);
    }
  };

  if (section === "account") {
    return null;
  }

  if (catalogQuery.isLoading || templatesQuery.isLoading || rulesQuery.isLoading) {
    return <SettingsFormSkeleton rows={6} />;
  }

  return (
    <>
      {section === "templates" ? (
        <section className="settings-surface">
        <div className="settings-surface-header">
          <div>
            <h2 className="settings-surface-title">
              {t("settings.integrations.sms.automation.templatesTitle")}
            </h2>
            <p className="settings-form-helper">
              {t("settings.integrations.sms.automation.templatesDescription")}
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            disabled={!canManage}
            onClick={resetTemplateForm}
            title={!canManage ? noPermissionTitle : undefined}
            type="button"
          >
            {t("settings.integrations.sms.automation.newTemplate")}
          </button>
        </div>
        <div className="settings-surface-body">
          <div className="settings-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="sms-template-existing">
                  {t("settings.integrations.sms.automation.existingTemplate")}
                </label>
                <CustomSelect
                  className="form-select"
                  id="sms-template-existing"
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  value={selectedTemplateId}
                >
                  <option value="new">{t("settings.integrations.sms.automation.newTemplate")}</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </CustomSelect>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sms-template-trigger">
                  {t("settings.integrations.sms.automation.trigger")}
                </label>
                <CustomSelect
                  className="form-select"
                  disabled={!canManage || currentTemplate !== null}
                  id="sms-template-trigger"
                  onChange={(event) => {
                    setSelectedTrigger(event.target.value);
                    setPreview(null);
                  }}
                  value={selectedTrigger}
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
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="sms-template-name">
                  {t("settings.integrations.sms.automation.templateName")}
                </label>
                <input
                  className="form-input"
                  disabled={!canManage}
                  id="sms-template-name"
                  maxLength={120}
                  onChange={(event) => setTemplateName(event.target.value)}
                  value={templateName}
                />
              </div>
              <div className="form-group">
                <span className="form-label">{t("settings.integrations.sms.status")}</span>
                <label className="switch-toggle settings-inline-status-toggle">
                  <input
                    checked={templateEnabled}
                    disabled={!canManage}
                    onChange={(event) => setTemplateEnabled(event.target.checked)}
                    type="checkbox"
                  />
                  <span aria-hidden="true" className="switch-toggle-control" />
                  <span>
                    {templateEnabled
                      ? t("settings.integrations.sms.automation.templateActive")
                      : t("settings.integrations.sms.automation.templatePassive")}
                  </span>
                </label>
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
              {currentTemplate ? (
                <button
                  className="btn btn-danger btn-sm"
                  disabled={!canManage || deleting}
                  onClick={() => void handleDelete()}
                  title={!canManage ? noPermissionTitle : undefined}
                  type="button"
                >
                  {t("common.delete")}
                </button>
              ) : null}
              <button
                className="btn btn-primary btn-sm"
                disabled={!canManage || savingTemplate || !templateName.trim() || !templateBody.trim()}
                onClick={() => void handleTemplateSave()}
                title={!canManage ? noPermissionTitle : undefined}
                type="button"
              >
                {savingTemplate ? t("settings.toolbar.saving") : t("settings.toolbar.save")}
              </button>
            </div>
          </div>
        </div>
        </section>
      ) : null}

      {section === "automation" ? (
        <section className="settings-surface">
        <div className="settings-surface-header">
          <div>
            <h2 className="settings-surface-title">
              {t("settings.integrations.sms.automation.rulesTitle")}
            </h2>
            <p className="settings-form-helper">
              {t("settings.integrations.sms.automation.rulesDescription")}
            </p>
            <p className="settings-form-helper">
              {t("settings.integrations.sms.automation.activationStatus")}
            </p>
          </div>
        </div>
        <div className="settings-surface-body">
          <div className="settings-form">
            {catalog.map((trigger) => {
              const draft = ruleDrafts[trigger.triggerType] ?? { templateId: "", enabled: false };
              const rule = rules.find((item) => item.triggerType === trigger.triggerType);
              const activationAvailable = trigger.triggerType === "candidate.created";
              const availableTemplates = templates.filter(
                (template) =>
                  template.triggerType === trigger.triggerType &&
                  (template.enabled || template.id === rule?.templateId),
              );
              return (
                <div className="form-row" key={trigger.triggerType}>
                  <div className="form-group">
                    <span className="form-label">
                      {getTriggerTitle(trigger.triggerType, trigger.title, t)}
                    </span>
                    <span className="settings-form-helper">
                      {getTriggerDescription(trigger.triggerType, trigger.description, t)}
                    </span>
                    <label className="switch-toggle settings-inline-status-toggle">
                      <input
                        checked={draft.enabled}
                        disabled={!canManage || !activationAvailable || !draft.templateId}
                        onChange={(event) =>
                          setRuleDrafts((current) => ({
                            ...current,
                            [trigger.triggerType]: { ...draft, enabled: event.target.checked },
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
                  <div className="form-group">
                    <label className="form-label" htmlFor={`sms-rule-template-${trigger.triggerType}`}>
                      {t("settings.integrations.sms.automation.template")}
                    </label>
                    <CustomSelect
                      className="form-select"
                      disabled={!canManage || availableTemplates.length === 0}
                      id={`sms-rule-template-${trigger.triggerType}`}
                      onChange={(event) =>
                        setRuleDrafts((current) => ({
                          ...current,
                          [trigger.triggerType]: { ...draft, templateId: event.target.value },
                        }))
                      }
                      value={draft.templateId}
                    >
                      <option value="">
                        {t("settings.integrations.sms.automation.selectTemplate")}
                      </option>
                      {availableTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {!template.enabled
                            ? ` (${t("settings.integrations.sms.automation.templatePassive")})`
                            : ""}
                        </option>
                      ))}
                    </CustomSelect>
                    {availableTemplates.length === 0 ? (
                      <span className="settings-form-helper">
                        {t("settings.integrations.sms.automation.noActiveTemplate")}
                      </span>
                    ) : null}
                    <div className="settings-form-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={!canManage || !draft.templateId || savingRule === trigger.triggerType}
                        onClick={() => void handleRuleSave(trigger.triggerType)}
                        title={!canManage ? noPermissionTitle : undefined}
                        type="button"
                      >
                        {savingRule === trigger.triggerType
                          ? t("settings.toolbar.saving")
                          : t("settings.toolbar.save")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </section>
      ) : null}
    </>
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

export function findSmsRule(
  rules: SmsAutomationRuleResponse[],
  triggerType: string,
): SmsAutomationRuleResponse | undefined {
  return rules.find((item) => item.triggerType === triggerType);
}

export function findSmsTemplate(
  templates: SmsTemplateResponse[],
  templateId: string,
): SmsTemplateResponse | undefined {
  return templates.find((item) => item.id === templateId);
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
