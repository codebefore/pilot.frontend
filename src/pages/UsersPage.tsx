import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AriaAttributes,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { PageToolbar } from "../components/layout/PageToolbar";
import { FilterIcon, PencilIcon, PlusIcon, TrashIcon } from "../components/icons";
import { UserFormModal } from "../components/modals/UserFormModal";
import { ColumnPicker } from "../components/ui/ColumnPicker";
import { Pagination } from "../components/ui/Pagination";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { TableHeaderFilter } from "../components/ui/TableHeaderFilter";
import { useToast } from "../components/ui/Toast";
import { ApiError } from "../lib/http";
import { getRoles } from "../lib/roles-api";
import { deleteUser, getUsers } from "../lib/users-api";
import type { AppUserResponse, RoleResponse } from "../lib/types";
import { useColumnVisibility } from "../lib/use-column-visibility";
import { formatPhone } from "../mock/users";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;

type UserSortField = "fullName" | "email" | "phone" | "mebbisUsername" | "roleName" | "isActive";
type SortDirection = "asc" | "desc";
type SortState = { field: UserSortField; direction: SortDirection } | null;
type UserColumnId = UserSortField;
type UserFilters = {
  fullName: string;
  email: string;
  phone: string;
  mebbisUsername: string;
  roleId: string;
  activity: "all" | "active" | "inactive";
};
type UserColumnDef = {
  id: UserColumnId;
  label: string;
  sortField: UserSortField;
  renderCell: (user: AppUserResponse) => ReactNode;
  skeletonWidth: number;
  skeletonKind?: "line" | "pill";
};

const DEFAULT_FILTERS: UserFilters = {
  fullName: "",
  email: "",
  phone: "",
  mebbisUsername: "",
  roleId: "all",
  activity: "all",
};

const USER_COLUMN_IDS: UserColumnId[] = [
  "fullName",
  "mebbisUsername",
  "email",
  "phone",
  "roleName",
  "isActive",
];

function buildColumns(): UserColumnDef[] {
  return [
    {
      id: "fullName",
      label: "Ad Soyad",
      sortField: "fullName",
      renderCell: (user) => <strong>{user.fullName}</strong>,
      skeletonWidth: 140,
    },
    {
      id: "mebbisUsername",
      label: "MEBBİS",
      sortField: "mebbisUsername",
      renderCell: (user) =>
        user.mebbisUsername ? (
          <>
            <span>{user.mebbisUsername}</span>
            {user.hasMebbisPassword ? (
              <div className="settings-table-secondary">Şifre kayıtlı</div>
            ) : null}
          </>
        ) : (
          <span className="form-subsection-note">—</span>
        ),
      skeletonWidth: 120,
    },
    {
      id: "email",
      label: "E-posta",
      sortField: "email",
      renderCell: (user) => user.email || "—",
      skeletonWidth: 180,
    },
    {
      id: "phone",
      label: "Telefon",
      sortField: "phone",
      renderCell: (user) => (user.phone ? formatPhone(user.phone) : "—"),
      skeletonWidth: 110,
    },
    {
      id: "roleName",
      label: "Rol",
      sortField: "roleName",
      renderCell: (user) =>
        user.roleName ? (
          <span className="cand-class-badge">{user.roleName}</span>
        ) : (
          <span className="form-subsection-note">Rol atanmamış</span>
        ),
      skeletonWidth: 80,
    },
    {
      id: "isActive",
      label: "Durum",
      sortField: "isActive",
      renderCell: (user) => (
        <StatusPill
          label={user.isActive ? "Aktif" : "Pasif"}
          status={user.isActive ? "success" : "manual"}
        />
      ),
      skeletonWidth: 56,
      skeletonKind: "pill",
    },
  ];
}

type UsersPageProps = {
  embedded?: boolean;
};

export function UsersPage({ embedded = false }: UsersPageProps) {
  const { showToast } = useToast();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "settings.users.columns.v1",
    USER_COLUMN_IDS
  );

  const [users, setUsers] = useState<AppUserResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sort, setSort] = useState<SortState>(null);
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUserResponse | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    Promise.all([
      getUsers({ includeInactive: true }, controller.signal),
      getRoles({ includeInactive: true }, controller.signal),
    ])
      .then(([userList, roleList]) => {
        setUsers(userList);
        setRoles(roleList);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast("Kullanıcılar yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey, showToast]);

  const roleFilterOptions = useMemo(
    () => [
      { value: "all", label: "Tüm Roller" },
      ...roles.map((role) => ({ value: role.id, label: role.name })),
    ],
    [roles]
  );

  const filtersActive = useMemo(
    () => search.trim().length > 0 || JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS),
    [filters, search]
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    const fullName = filters.fullName.trim().toLocaleLowerCase("tr-TR");
    const email = filters.email.trim().toLocaleLowerCase("tr-TR");
    const phone = filters.phone.replace(/\D/g, "");
    const mebbisUsername = filters.mebbisUsername.trim().toLocaleLowerCase("tr-TR");

    return users.filter((user) => {
      if (query) {
        const haystack = [
          user.fullName,
          user.email ?? "",
          user.phone ?? "",
          user.mebbisUsername ?? "",
          user.roleName ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR");
        if (!haystack.includes(query)) return false;
      }
      if (fullName && !user.fullName.toLocaleLowerCase("tr-TR").includes(fullName)) {
        return false;
      }
      if (email && !(user.email ?? "").toLocaleLowerCase("tr-TR").includes(email)) {
        return false;
      }
      if (phone && !(user.phone ?? "").replace(/\D/g, "").includes(phone)) {
        return false;
      }
      if (
        mebbisUsername &&
        !(user.mebbisUsername ?? "").toLocaleLowerCase("tr-TR").includes(mebbisUsername)
      ) {
        return false;
      }
      if (filters.roleId !== "all" && user.roleId !== filters.roleId) {
        return false;
      }
      if (filters.activity === "active" && !user.isActive) {
        return false;
      }
      if (filters.activity === "inactive" && user.isActive) {
        return false;
      }
      return true;
    });
  }, [filters, search, users]);

  const sortedUsers = useMemo(() => {
    if (!sort) return filteredUsers;
    const multiplier = sort.direction === "asc" ? 1 : -1;
    return filteredUsers.slice().sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return (Number(av) - Number(bv)) * multiplier;
      }
      return String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
        sensitivity: "base",
      }) * multiplier;
    });
  }, [filteredUsers, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const visibleColumns = useMemo(() => buildColumns().filter((column) => isVisible(column.id)), [isVisible]);
  const pagedUsers = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedUsers.slice(start, start + pageSize);
  }, [page, pageSize, sortedUsers, totalPages]);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.isActive).length,
      inactive: users.filter((user) => !user.isActive).length,
      mebbis: users.filter((user) => user.mebbisUsername || user.hasMebbisPassword).length,
    }),
    [users]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSortToggle = (field: UserSortField) => {
    setPage(1);
    setSort((current) => {
      if (!current || current.field !== field) {
        return { field, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { field, direction: "desc" };
      }
      return null;
    });
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (user: AppUserResponse) => {
    setEditing(user);
    setFormOpen(true);
  };

  const handleSaved = (saved: AppUserResponse) => {
    setFormOpen(false);
    showToast(editing ? "Kullanıcı güncellendi" : "Kullanıcı eklendi");
    setEditing(null);
    setUsers((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [...prev, saved];
      const next = prev.slice();
      next[idx] = saved;
      return next;
    });
    setRefreshKey((k) => k + 1);
  };

  const handleDelete = async (user: AppUserResponse) => {
    setDeletingUserId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setConfirmDeleteUserId(null);
      showToast("Kullanıcı silindi");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Kullanıcı silinemedi";
      showToast(message, "error");
    } finally {
      setDeletingUserId(null);
    }
  };

  const setFilter = <K extends keyof UserFilters>(field: K, value: UserFilters[K]) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSearchResetKey((current) => current + 1);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const handleColumnToggle = (id: string) => {
    if (isVisible(id) && sort?.field === id) setSort(null);
    if (isVisible(id)) {
      if (id === "fullName") setFilter("fullName", DEFAULT_FILTERS.fullName);
      if (id === "email") setFilter("email", DEFAULT_FILTERS.email);
      if (id === "phone") setFilter("phone", DEFAULT_FILTERS.phone);
      if (id === "mebbisUsername") setFilter("mebbisUsername", DEFAULT_FILTERS.mebbisUsername);
      if (id === "roleName") setFilter("roleId", DEFAULT_FILTERS.roleId);
      if (id === "isActive") setFilter("activity", DEFAULT_FILTERS.activity);
    }
    toggleColumn(id);
  };

  const actions = (
    <>
      <div className="search-box settings-module-search settings-module-search-compact">
        <SearchInput
          debounceMs={SEARCH_DEBOUNCE_MS}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Kullanıcı ara"
          resetSignal={searchResetKey}
          value={search}
        />
      </div>
      {filtersActive ? (
        <button
          className="btn btn-secondary btn-sm"
          onClick={clearFilters}
          type="button"
        >
          Filtreleri Temizle
        </button>
      ) : null}
      <button className="btn btn-primary btn-sm" onClick={openCreate} type="button">
        <PlusIcon size={14} />
        Kullanıcı Ekle
      </button>
    </>
  );

  const table = (
    <>
      <table className="data-table">
        <thead>
          <tr>
            {visibleColumns.map((column) => (
              <SortableTh
                field={column.sortField}
                filterControl={buildColumnFilterControl(
                  column.id,
                  filters,
                  setFilter,
                  roleFilterOptions
                )}
                key={column.id}
                label={column.label}
                onToggle={handleSortToggle}
                sort={sort}
              />
            ))}
            <th className="col-picker-th">
              <ColumnPicker
                columns={buildColumns().map((column) => ({
                  id: column.id,
                  label: column.label,
                }))}
                isVisible={isVisible}
                onToggle={handleColumnToggle}
                triggerTitle="Sütunlar"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 4 }, (_, index) => (
              <tr key={index} style={{ pointerEvents: "none" }}>
                {visibleColumns.map((column) => (
                  <td key={column.id}>
                    <span
                      className={
                        column.skeletonKind === "pill" ? "skeleton skeleton-pill" : "skeleton"
                      }
                      style={{ width: column.skeletonWidth }}
                    />
                  </td>
                ))}
                <td className="col-picker-td">
                  <span className="skeleton" style={{ width: 24 }} />
                </td>
              </tr>
            ))
          ) : pagedUsers.length === 0 ? (
            <tr>
              <td className="data-table-empty" colSpan={visibleColumns.length + 1}>
                Henüz kullanıcı yok.
              </td>
            </tr>
          ) : (
            pagedUsers.map((user) => (
              <tr key={user.id}>
                {visibleColumns.map((column) => (
                  <td key={column.id}>{column.renderCell(user)}</td>
                ))}
                <td className="col-picker-td">
                  <div
                    className={
                      confirmDeleteUserId === user.id
                        ? "table-row-actions table-row-actions-confirm"
                        : "table-row-actions"
                    }
                  >
                    {confirmDeleteUserId === user.id ? (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={deletingUserId === user.id}
                          onClick={() => setConfirmDeleteUserId(null)}
                          type="button"
                        >
                          Vazgeç
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={deletingUserId === user.id}
                          onClick={() => handleDelete(user)}
                          type="button"
                        >
                          {deletingUserId === user.id ? "Siliniyor..." : "Sil"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          aria-label="Düzenle"
                          className="icon-btn"
                          onClick={() => openEdit(user)}
                          title="Düzenle"
                          type="button"
                        >
                          <PencilIcon size={14} />
                        </button>
                        <button
                          aria-label="Sil"
                          className="icon-btn icon-btn-danger"
                          disabled={deletingUserId !== null}
                          onClick={() => setConfirmDeleteUserId(user.id)}
                          title="Sil"
                          type="button"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <Pagination
        disabled={loading}
        onChange={setPage}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        }}
        page={Math.min(page, totalPages)}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        totalPages={totalPages}
      />
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="settings-section-stack">
          <div className="settings-summary-grid">
            <div className="settings-summary-card">
              <span className="settings-summary-label">Toplam Kullanıcı</span>
              <strong className="settings-summary-value">{counts.total}</strong>
            </div>
            <div className="settings-summary-card">
              <span className="settings-summary-label">Aktif</span>
              <strong className="settings-summary-value">{counts.active}</strong>
            </div>
            <div className="settings-summary-card">
              <span className="settings-summary-label">Pasif</span>
              <strong className="settings-summary-value">{counts.inactive}</strong>
            </div>
            <div className="settings-summary-card">
              <span className="settings-summary-label">MEBBİS Tanımlı</span>
              <strong className="settings-summary-value">{counts.mebbis}</strong>
            </div>
          </div>

          <section className="settings-surface">
            <div className="settings-surface-header">
              <div className="settings-surface-title">Kullanıcılar</div>
              <div className="settings-module-actions">{actions}</div>
            </div>
            <div className="settings-surface-body">
              {table}
            </div>
          </section>
        </div>
      ) : (
        <>
          <PageToolbar actions={actions} title="Kullanıcılar" />
          <div className="table-wrap spaced">{table}</div>
        </>
      )}
      <UserFormModal
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
        open={formOpen}
        roles={roles}
      />
    </>
  );
}

type SortableThProps = {
  field: UserSortField;
  filterControl?: ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: UserSortField) => void;
};

function SortableTh({ field, filterControl, label, sort, onToggle }: SortableThProps) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort: AriaAttributes["aria-sort"] = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th aria-sort={ariaSort} className={isActive ? "sortable-th active" : "sortable-th"}>
      <div className="sortable-th-shell">
        <button className="sortable-th-btn" onClick={() => onToggle(field)} type="button">
          <span>{label}</span>
          <span aria-hidden="true" className="sortable-th-indicator">
            {indicator}
          </span>
        </button>
        {filterControl ? <div className="sortable-th-filter">{filterControl}</div> : null}
      </div>
    </th>
  );
}

function buildColumnFilterControl(
  columnId: UserColumnId,
  filters: UserFilters,
  setFilter: <K extends keyof UserFilters>(field: K, value: UserFilters[K]) => void,
  roleFilterOptions: { value: string; label: string }[]
) {
  if (columnId === "fullName") {
    return (
      <TableHeaderTextFilter
        active={filters.fullName.trim().length > 0}
        onApply={(value) => setFilter("fullName", value)}
        onClear={() => setFilter("fullName", "")}
        placeholder="Ad soyad ara"
        title="Ad Soyad filtresi"
        value={filters.fullName}
      />
    );
  }

  if (columnId === "mebbisUsername") {
    return (
      <TableHeaderTextFilter
        active={filters.mebbisUsername.trim().length > 0}
        onApply={(value) => setFilter("mebbisUsername", value)}
        onClear={() => setFilter("mebbisUsername", "")}
        placeholder="MEBBİS kullanıcı ara"
        title="MEBBİS filtresi"
        value={filters.mebbisUsername}
      />
    );
  }

  if (columnId === "email") {
    return (
      <TableHeaderTextFilter
        active={filters.email.trim().length > 0}
        onApply={(value) => setFilter("email", value)}
        onClear={() => setFilter("email", "")}
        placeholder="E-posta ara"
        title="E-posta filtresi"
        value={filters.email}
      />
    );
  }

  if (columnId === "phone") {
    return (
      <TableHeaderTextFilter
        active={filters.phone.trim().length > 0}
        onApply={(value) => setFilter("phone", value)}
        onClear={() => setFilter("phone", "")}
        placeholder="Telefon ara"
        title="Telefon filtresi"
        value={filters.phone}
      />
    );
  }

  if (columnId === "roleName") {
    return (
      <TableHeaderFilter
        active={filters.roleId !== DEFAULT_FILTERS.roleId}
        onChange={(value) => setFilter("roleId", value)}
        options={roleFilterOptions}
        title="Rol filtresi"
        value={filters.roleId}
      />
    );
  }

  if (columnId === "isActive") {
    return (
      <TableHeaderFilter
        active={filters.activity !== DEFAULT_FILTERS.activity}
        onChange={(value) => setFilter("activity", value as UserFilters["activity"])}
        options={[
          { value: "all", label: "Tüm Durumlar" },
          { value: "active", label: "Aktif" },
          { value: "inactive", label: "Pasif" },
        ]}
        title="Durum filtresi"
        value={filters.activity}
      />
    );
  }

  return null;
}

const FILTER_MENU_VIEWPORT_GAP = 8;
const FILTER_MENU_TRIGGER_GAP = 6;
const FILTER_MENU_FALLBACK_WIDTH = 220;
const FILTER_MENU_FALLBACK_HEIGHT = 150;

type TableHeaderTextFilterProps = {
  active: boolean;
  onApply: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  title: string;
  value: string;
};

function TableHeaderTextFilter({
  active,
  onApply,
  onClear,
  placeholder,
  title,
  value,
}: TableHeaderTextFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const measuredWidth = menuRef.current?.offsetWidth ?? FILTER_MENU_FALLBACK_WIDTH;
      const measuredHeight = menuRef.current?.offsetHeight ?? FILTER_MENU_FALLBACK_HEIGHT;
      const maxLeft = Math.max(
        FILTER_MENU_VIEWPORT_GAP,
        window.innerWidth - measuredWidth - FILTER_MENU_VIEWPORT_GAP
      );
      const left = Math.min(
        Math.max(triggerRect.right - measuredWidth, FILTER_MENU_VIEWPORT_GAP),
        maxLeft
      );
      const belowTop = triggerRect.bottom + FILTER_MENU_TRIGGER_GAP;
      const aboveTop = triggerRect.top - measuredHeight - FILTER_MENU_TRIGGER_GAP;
      const fitsBelow = belowTop + measuredHeight <= window.innerHeight - FILTER_MENU_VIEWPORT_GAP;
      const fitsAbove = aboveTop >= FILTER_MENU_VIEWPORT_GAP;
      const top = fitsBelow
        ? belowTop
        : fitsAbove
          ? aboveTop
          : Math.max(
              FILTER_MENU_VIEWPORT_GAP,
              window.innerHeight - measuredHeight - FILTER_MENU_VIEWPORT_GAP
            );

      setMenuPos({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(draft.trim());
    setOpen(false);
  };

  return (
    <div className={open ? "table-header-filter open" : "table-header-filter"} ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={title}
        className={`table-header-filter-trigger${active ? " active" : ""}`}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        title={title}
        type="button"
      >
        <FilterIcon size={12} />
      </button>

      {open
        ? createPortal(
            <div
              className="table-header-filter-menu table-header-filter-text-menu"
              ref={menuRef}
              role="dialog"
              style={menuPos ? { top: menuPos.top, left: menuPos.left } : undefined}
            >
              <div className="table-header-filter-title">{title}</div>
              <form className="table-header-filter-form" onSubmit={submit}>
                <input
                  autoFocus
                  className="table-header-filter-input"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={placeholder}
                  type="search"
                  value={draft}
                />
                <div className="table-header-filter-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onClear();
                      setOpen(false);
                    }}
                    type="button"
                  >
                    Temizle
                  </button>
                  <button className="btn btn-primary btn-sm" type="submit">
                    Uygula
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
