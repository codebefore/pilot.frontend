import { useState } from "react";

import { PageToolbar } from "../components/layout/PageToolbar";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import {
  initialPermissionMatrix,
  LEVEL_LABELS,
  PERMISSION_AREAS,
  PERMISSION_ROLES,
  type PermissionArea,
  type PermissionLevel,
  type PermissionMatrix,
} from "../mock/permissions";
import type { UserRole } from "../mock/users";

const LEVELS: PermissionLevel[] = ["none", "view", "full"];

export function PermissionsPage() {
  const [matrix, setMatrix] = useState<PermissionMatrix>(initialPermissionMatrix);
  const [dirty, setDirty] = useState(false);
  const { showToast } = useToast();

  const update = (role: UserRole, area: PermissionArea, level: PermissionLevel) => {
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [area]: level },
    }));
    setDirty(true);
  };

  const handleSave = () => {
    setDirty(false);
    showToast("Yetkiler kaydedildi");
  };

  const handleReset = () => {
    setMatrix(initialPermissionMatrix);
    setDirty(false);
    showToast("Değişiklikler geri alındı");
  };

  return (
    <>
      <PageToolbar
        actions={
          <>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!dirty}
              onClick={handleReset}
              type="button"
            >
              Geri Al
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!dirty}
              onClick={handleSave}
              type="button"
            >
              Kaydet
            </button>
          </>
        }
        title="Yetki Yönetimi"
      />

      <div className="table-wrap spaced">
        <Panel>
          <table className="data-table permissions-matrix">
            <thead>
              <tr>
                <th>Modül</th>
                {PERMISSION_ROLES.map((role) => (
                  <th key={role}>{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_AREAS.map((area) => (
                <tr key={area.key}>
                  <td>{area.label}</td>
                  {PERMISSION_ROLES.map((role) => {
                    const level = matrix[role][area.key];
                    return (
                      <td key={role}>
                        <select
                          className={`perm-select level-${level}`}
                          onChange={(e) =>
                            update(role, area.key, e.target.value as PermissionLevel)
                          }
                          value={level}
                        >
                          {LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {LEVEL_LABELS[l]}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
