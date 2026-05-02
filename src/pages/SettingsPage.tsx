import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { PageToolbar } from "../components/layout/PageToolbar";
import { ClassroomsSettingsSection } from "../components/settings/ClassroomsSettingsSection";
import { FeesSettingsSection } from "../components/settings/FeesSettingsSection";
import { GeneralInstitutionSection } from "../components/settings/GeneralInstitutionSection";
import { InstructorsSettingsSection } from "../components/settings/InstructorsSettingsSection";
import { LicenseClassDefinitionsSettingsSection } from "../components/settings/LicenseClassDefinitionsSettingsSection";
import { TrainingBranchesSettingsSection } from "../components/settings/TrainingBranchesSettingsSection";
import { VehiclesSettingsSection } from "../components/settings/VehiclesSettingsSection";
import { useT, type TranslationKey } from "../lib/i18n";
import { DocumentTypesPage } from "./DocumentTypesPage";
import { InstructorDetailPage } from "./InstructorDetailPage";
import { LicenseClassDefinitionDetailPage } from "./LicenseClassDefinitionDetailPage";
import { PermissionsPage } from "./PermissionsPage";
import { RoleEditorPage } from "./RoleEditorPage";
import { UsersPage } from "./UsersPage";
import { VehicleDetailPage } from "./VehicleDetailPage";

type SettingsNavItem = {
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  to?: string;
  badge?: string;
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
      },
      {
        labelKey: "settings.nav.instructors.label",
        descriptionKey: "settings.nav.instructors.description",
        to: "/settings/definitions/instructors",
      },
      {
        labelKey: "settings.nav.vehicles.label",
        descriptionKey: "settings.nav.vehicles.description",
        to: "/settings/definitions/vehicles",
      },
    ],
  },
  {
    titleKey: "settings.nav.group.definitions",
    items: [
      {
        labelKey: "settings.nav.licenseClasses.label",
        descriptionKey: "settings.nav.licenseClasses.description",
        to: "/settings/definitions/license-classes",
      },
      {
        labelKey: "settings.nav.trainingBranches.label",
        descriptionKey: "settings.nav.trainingBranches.description",
        to: "/settings/definitions/training-branches",
      },
      {
        labelKey: "settings.nav.classrooms.label",
        descriptionKey: "settings.nav.classrooms.description",
        to: "/settings/definitions/classrooms",
      },
      {
        labelKey: "settings.nav.fees.label",
        descriptionKey: "settings.nav.fees.description",
        to: "/settings/definitions/fees",
      },
      {
        labelKey: "settings.nav.documentTypes.label",
        descriptionKey: "settings.nav.documentTypes.description",
        to: "/settings/definitions/document-types",
      },
      {
        labelKey: "settings.nav.users.label",
        descriptionKey: "settings.nav.users.description",
        to: "/settings/definitions/users",
      },
      {
        labelKey: "settings.nav.permissions.label",
        descriptionKey: "settings.nav.permissions.description",
        to: "/settings/definitions/permissions",
      },
    ],
  },
];

export function SettingsPage() {
  const t = useT();

  return (
    <>
      <PageToolbar title={t("settings.title")} />

      <div className="settings-page">
        <div className="settings-shell">
          <aside className="settings-nav">
            <div className="settings-nav-groups">
              {SETTINGS_NAV_GROUPS.map((group) => (
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

          <div className="settings-content">
            <Routes>
              <Route index element={<Navigate replace to="general" />} />
              <Route element={<GeneralInstitutionSection />} path="general" />
              <Route element={<Navigate replace to="license-classes" />} path="definitions" />
              <Route
                element={<LicenseClassDefinitionsSettingsSection />}
                path="definitions/license-classes"
              />
              <Route
                element={<LicenseClassDefinitionDetailPage />}
                path="definitions/license-classes/:definitionId"
              />
              <Route
                element={<TrainingBranchesSettingsSection />}
                path="definitions/training-branches"
              />
              <Route element={<ClassroomsSettingsSection />} path="definitions/classrooms" />
              <Route element={<FeesSettingsSection />} path="definitions/fees" />
              <Route
                element={<DocumentTypesPage embedded />}
                path="definitions/document-types"
              />
              <Route element={<VehiclesSettingsSection />} path="definitions/vehicles" />
              <Route element={<VehicleDetailPage />} path="definitions/vehicles/:vehicleId" />
              <Route element={<InstructorsSettingsSection />} path="definitions/instructors" />
              <Route element={<InstructorDetailPage />} path="definitions/instructors/:instructorId" />
              <Route element={<UsersPage embedded />} path="definitions/users" />
              <Route element={<PermissionsPage embedded />} path="definitions/permissions" />
              <Route element={<RoleEditorPage />} path="definitions/permissions/roles/new" />
              <Route element={<RoleEditorPage />} path="definitions/permissions/roles/:roleId" />
              <Route element={<Navigate replace to="general" />} path="*" />
            </Routes>
          </div>
        </div>
      </div>
    </>
  );
}
