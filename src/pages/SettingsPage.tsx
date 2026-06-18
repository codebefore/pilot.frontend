import type { ReactElement } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { PageToolbar } from "../components/layout/PageToolbar";
import { CashRegistersSettingsSection } from "../components/settings/CashRegistersSettingsSection";
import { LicenseClassFeeMatrixSettingsSection } from "../components/settings/LicenseClassFeeMatrixSettingsSection";
import { ClassroomsSettingsSection } from "../components/settings/ClassroomsSettingsSection";
import { GeneralInstitutionSection } from "../components/settings/GeneralInstitutionSection";
import { InstructorsSettingsSection } from "../components/settings/InstructorsSettingsSection";
import { IntegrationsSettingsSection } from "../components/settings/IntegrationsSettingsSection";
import { LicenseClassDefinitionsSettingsSection } from "../components/settings/LicenseClassDefinitionsSettingsSection";
import { MigrationSettingsSection } from "../components/settings/MigrationSettingsSection";
import { ReferencesSettingsSection } from "../components/settings/ReferencesSettingsSection";
import { TrainingBranchesSettingsSection } from "../components/settings/TrainingBranchesSettingsSection";
import { VehiclesSettingsSection } from "../components/settings/VehiclesSettingsSection";
import { useAuth } from "../lib/auth";
import { useT, type TranslationKey } from "../lib/i18n";
import { canViewAnyArea } from "../lib/permissions";
import { DocumentTypesPage } from "./DocumentTypesPage";
import { InstructorDetailPage } from "./InstructorDetailPage";
import { LicenseClassDefinitionDetailPage } from "./LicenseClassDefinitionDetailPage";
import { RoleEditorPage } from "./RoleEditorPage";
import { UsersPage } from "./UsersPage";
import { VehicleDetailPage } from "./VehicleDetailPage";

type SettingsNavItem = {
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  to?: string;
  badge?: string;
  permissionAreas: readonly string[];
};

type SettingsNavGroup = {
  titleKey: TranslationKey;
  items: SettingsNavItem[];
};

const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    titleKey: "settings.nav.group.institution",
    items: [
      {
        labelKey: "settings.nav.general.label",
        descriptionKey: "settings.nav.general.description",
        to: "/settings/general",
        permissionAreas: ["settings"],
      },
      {
        labelKey: "settings.nav.users.label",
        descriptionKey: "settings.nav.users.description",
        to: "/settings/definitions/users",
        permissionAreas: ["users", "permissions"],
      },
      {
        labelKey: "settings.nav.instructors.label",
        descriptionKey: "settings.nav.instructors.description",
        to: "/settings/definitions/instructors",
        permissionAreas: ["training"],
      },
      {
        labelKey: "settings.nav.vehicles.label",
        descriptionKey: "settings.nav.vehicles.description",
        to: "/settings/definitions/vehicles",
        permissionAreas: ["training"],
      },
    ],
  },
  {
    titleKey: "settings.nav.group.definitions",
    items: [
      {
        labelKey: "settings.nav.references.label",
        descriptionKey: "settings.nav.references.description",
        to: "/settings/definitions/references",
        permissionAreas: ["candidates"],
      },
      {
        labelKey: "settings.nav.licenseClasses.label",
        descriptionKey: "settings.nav.licenseClasses.description",
        to: "/settings/definitions/license-classes",
        permissionAreas: ["settings"],
      },
      {
        labelKey: "settings.nav.fees.label",
        descriptionKey: "settings.nav.fees.description",
        to: "/settings/definitions/fees",
        permissionAreas: ["payments"],
      },
      {
        labelKey: "settings.nav.trainingBranches.label",
        descriptionKey: "settings.nav.trainingBranches.description",
        to: "/settings/definitions/training-branches",
        permissionAreas: ["training"],
      },
      {
        labelKey: "settings.nav.classrooms.label",
        descriptionKey: "settings.nav.classrooms.description",
        to: "/settings/definitions/classrooms",
        permissionAreas: ["training"],
      },
      {
        labelKey: "settings.nav.documentTypes.label",
        descriptionKey: "settings.nav.documentTypes.description",
        to: "/settings/definitions/document-types",
        permissionAreas: ["documentTypes", "documents"],
      },
      {
        labelKey: "settings.nav.cashRegisters.label",
        descriptionKey: "settings.nav.cashRegisters.description",
        to: "/settings/definitions/cash-registers",
        permissionAreas: ["payments"],
      },
      {
        labelKey: "settings.nav.integrations.label",
        descriptionKey: "settings.nav.integrations.description",
        to: "/settings/definitions/integrations",
        permissionAreas: ["settings", "mebjobs"],
      },
      {
        labelKey: "settings.nav.migration.label",
        descriptionKey: "settings.nav.migration.description",
        to: "/settings/definitions/migration",
        permissionAreas: ["settings", "mebjobs", "training"],
      },
    ],
  },
];

function isFeesRoute(pathname: string) {
  return pathname.replace(/\/+$/, "") === "/settings/definitions/fees";
}

export function SettingsPage() {
  const t = useT();
  const location = useLocation();
  const { user, permissions } = useAuth();
  const fullScreenFees = isFeesRoute(location.pathname);
  const visibleGroups = SETTINGS_NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canViewAnyArea(user, permissions, item.permissionAreas)),
    }))
    .filter((group) => group.items.length > 0);
  const firstVisiblePath = visibleGroups.flatMap((group) => group.items).find((item) => item.to)?.to ?? "/profile";

  const requireSettingsPermission = (areas: readonly string[], element: ReactElement) =>
    canViewAnyArea(user, permissions, areas) ? element : <Navigate replace to={firstVisiblePath} />;

  return (
    <>
      {!fullScreenFees ? <PageToolbar title={t("settings.title")} /> : null}

      <div className={fullScreenFees ? "settings-page settings-page-fullscreen" : "settings-page"}>
        <div className={fullScreenFees ? "settings-shell settings-shell-fullscreen" : "settings-shell"}>
          {!fullScreenFees ? (
          <aside className="settings-nav">
            <div className="settings-nav-groups">
              {visibleGroups.map((group) => (
                <section className="settings-nav-group" key={group.titleKey}>
                  <div className="settings-nav-group-title">{t(group.titleKey)}</div>

                  <div className="settings-nav-list">
                    {group.items.map((item) =>
                      item.to ? (
                        <NavLink
                          className={({ isActive }) =>
                            isActive ? "settings-nav-link active" : "settings-nav-link"
                          }
                          end
                          key={item.labelKey}
                          state={item.to === "/settings/definitions/fees" ? { from: location.pathname } : undefined}
                          to={item.to}
                        >
                          <span className="settings-nav-link-copy">
                            <strong className="settings-nav-link-title">{t(item.labelKey)}</strong>
                            <span className="settings-nav-link-description">
                              {t(item.descriptionKey)}
                            </span>
                          </span>
                        </NavLink>
                      ) : (
                        <div
                          aria-disabled="true"
                          className="settings-nav-link settings-nav-link-disabled"
                          key={item.labelKey}
                        >
                          <span className="settings-nav-link-copy">
                            <strong className="settings-nav-link-title">{t(item.labelKey)}</strong>
                            <span className="settings-nav-link-description">
                              {t(item.descriptionKey)}
                            </span>
                          </span>
                          {item.badge ? (
                            <span className="settings-nav-link-badge">{item.badge}</span>
                          ) : null}
                        </div>
                      )
                    )}
                  </div>
                </section>
              ))}
            </div>
          </aside>
          ) : null}

          <div className="settings-content">
            <Routes>
              <Route index element={<Navigate replace to={firstVisiblePath} />} />
              <Route
                element={requireSettingsPermission(["settings"], <GeneralInstitutionSection />)}
                path="general"
              />
              <Route element={<Navigate replace to={firstVisiblePath} />} path="definitions" />
              <Route
                element={requireSettingsPermission(["settings"], <LicenseClassDefinitionsSettingsSection />)}
                path="definitions/license-classes"
              />
              <Route
                element={requireSettingsPermission(["settings"], <LicenseClassDefinitionDetailPage />)}
                path="definitions/license-classes/:definitionId"
              />
              <Route
                element={requireSettingsPermission(["training"], <TrainingBranchesSettingsSection />)}
                path="definitions/training-branches"
              />
              <Route
                element={requireSettingsPermission(["candidates"], <ReferencesSettingsSection />)}
                path="definitions/references"
              />
              <Route
                element={requireSettingsPermission(["training"], <ClassroomsSettingsSection />)}
                path="definitions/classrooms"
              />
              <Route
                element={requireSettingsPermission(["payments"], <LicenseClassFeeMatrixSettingsSection />)}
                path="definitions/fees"
              />
              <Route
                element={requireSettingsPermission(["documentTypes", "documents"], <DocumentTypesPage embedded />)}
                path="definitions/document-types"
              />
              <Route
                element={requireSettingsPermission(["training"], <VehiclesSettingsSection />)}
                path="definitions/vehicles"
              />
              <Route
                element={requireSettingsPermission(["training"], <VehicleDetailPage />)}
                path="definitions/vehicles/:vehicleId"
              />
              <Route
                element={requireSettingsPermission(["payments"], <CashRegistersSettingsSection />)}
                path="definitions/cash-registers"
              />
              <Route
                element={requireSettingsPermission(["settings", "mebjobs"], <IntegrationsSettingsSection />)}
                path="definitions/integrations"
              />
              <Route
                element={requireSettingsPermission(["settings", "mebjobs", "training"], <MigrationSettingsSection />)}
                path="definitions/migration"
              />
              <Route
                element={requireSettingsPermission(["training"], <InstructorsSettingsSection />)}
                path="definitions/instructors"
              />
              <Route
                element={requireSettingsPermission(["training"], <InstructorDetailPage />)}
                path="definitions/instructors/:instructorId"
              />
              <Route
                element={requireSettingsPermission(["users", "permissions"], <UsersPage embedded />)}
                path="definitions/users"
              />
              <Route
                element={requireSettingsPermission(["permissions"], <RoleEditorPage />)}
                path="definitions/users/permissions/roles/new"
              />
              <Route
                element={requireSettingsPermission(["permissions"], <RoleEditorPage />)}
                path="definitions/users/permissions/roles/:roleId"
              />
              <Route
                element={<Navigate replace to="/settings/definitions/users?tab=permissions" />}
                path="definitions/permissions"
              />
              <Route
                element={<Navigate replace to="/settings/definitions/users?tab=permissions" />}
                path="definitions/permissions/roles/new"
              />
              <Route
                element={<Navigate replace to="/settings/definitions/users?tab=permissions" />}
                path="definitions/permissions/roles/:roleId"
              />
              <Route element={<Navigate replace to={firstVisiblePath} />} path="*" />
            </Routes>
          </div>
        </div>
      </div>
    </>
  );
}
