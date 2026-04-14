import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "tr" | "en";

const STORAGE_KEY = "pilot.lang";
const DEFAULT_LANG: Language = "tr";

/* ── Dictionaries ─────────────────────────────────────────────── */

const tr = {
  // Common
  "common.save": "Kaydet",
  "common.cancel": "Vazgeç",
  "common.delete": "Sil",
  "common.edit": "Düzenle",
  "common.loading": "Yükleniyor...",
  "common.noResults": "Sonuç bulunamadı",
  "common.prev": "← Önceki",
  "common.next": "Sonraki →",
  "common.all": "Tümü",
  "common.close": "Kapat",
  "common.search": "Ara",
  "common.clearFilters": "Filtreleri Temizle",

  // Header
  "header.notifications": "Bildirimler",
  "header.newNotifications": "{count} yeni bildirim",
  "header.menu": "Menüyü aç",
  "header.logout": "Çıkış Yap",
  "header.languageToggle": "Dili değiştir",

  // Nav / Sidebar
  "nav.main": "Ana",
  "nav.operations": "Operasyon",
  "nav.mebIntegration": "MEB Entegrasyonu",
  "nav.administration": "Yönetim",
  "nav.dashboard": "Kontrol Paneli",
  "nav.candidates": "Adaylar",
  "nav.groups": "Gruplar",
  "nav.documents": "Evrak",
  "nav.documentTypes": "Belge Türleri",
  "nav.payments": "Tahsilat",
  "nav.training": "Eğitim Planı",
  "nav.mebJobs": "MEB İşleri",
  "nav.settings": "Kurum Ayarları",
  "nav.users": "Kullanıcılar",
  "nav.permissions": "Yetki Yönetimi",
  "nav.login": "Giriş",

  // Login
  "login.title": "Pilot",
  "login.subtitle": "Sürücü kursu yönetim paneli",
  "login.email": "E-posta",
  "login.password": "Şifre",
  "login.emailPlaceholder": "ornek@pilot.com",
  "login.submit": "Giriş Yap",
  "login.submitting": "Giriş yapılıyor...",
  "login.forgotPassword": "Şifrenizi mi unuttunuz?",
  "login.errors.emailRequired": "E-posta gerekli",
  "login.errors.passwordRequired": "Şifre gerekli",
  "login.errors.failed": "Giriş yapılamadı",
  "login.errors.credentialsRequired": "E-posta ve şifre gerekli",

  // Forgot password
  "forgot.title": "Şifremi Unuttum",
  "forgot.subtitle": "E-posta adresini gir, sıfırlama bağlantısı gönderelim",
  "forgot.sentTitle": "Sıfırlama bağlantısını gönderdik",
  "forgot.successBody":
    "{email} adresine sıfırlama bağlantısı gönderildi. Gelen kutunu kontrol et. Mail gelmediyse spam klasörüne bakmayı unutma.",
  "forgot.submit": "Sıfırlama Bağlantısı Gönder",
  "forgot.submitting": "Gönderiliyor...",
  "forgot.backToLogin": "← Giriş sayfasına dön",
  "forgot.backToLoginBtn": "Giriş Sayfasına Dön",

  // Groups page
  "groups.title": "Gruplar",
  "groups.newGroup": "Yeni Grup",
  "groups.searchPlaceholder": "Grup ara...",
  "groups.view.label": "Görünüm",
  "groups.view.cards": "Kartlar",
  "groups.view.list": "Liste",
  "groups.filter.allLicenseClasses": "Tüm Sınıflar",
  "groups.filter.allMebStatuses": "Tüm MEB Durumları",
  "groups.filter.licenseClass": "Lisans Sınıfı",
  "groups.filter.mebStatus": "MEB Durumu",
  "groups.empty.noGroupsForTab": "Gösterilecek grup yok.",
  "groups.empty.noMatches": "Filtrelerle eşleşen grup bulunamadı.",
  "groups.empty.noTermSelected": "Başlamak için bir dönem seç.",
  "groups.loadFailed": "Gruplar yüklenemedi",
  "groups.created": "Grup başarıyla oluşturuldu",

  // Group card fields
  "groups.card.capacity": "Kontenjan",
  "groups.card.startDate": "Başlangıç",
  "groups.card.mebStatus": "MEB Durumu",
  "groups.table.name": "Grup",
  "groups.table.capacity": "Kontenjan",
  "groups.table.startDate": "Başlangıç",
  "groups.table.mebStatus": "MEB Durumu",

  // Terms
  "terms.title": "Dönemler",
  "terms.newTerm": "Yeni Dönem",
  "terms.select": "Dönem seç",
  "terms.selector.label": "Dönem",
  "terms.selector.none": "— Dönem seçilmedi —",
  "terms.allTerms": "Tüm Dönemler",
  "terms.loadFailed": "Dönemler yüklenemedi",
  "terms.created": "Dönem oluşturuldu",
  "terms.createFailed": "Dönem oluşturulamadı",
  "terms.updated": "Dönem güncellendi",
  "terms.updateFailed": "Dönem güncellenemedi",
  "terms.deleted": "Dönem silindi",
  "terms.deleteFailed": "Dönem silinemedi",
  "terms.confirmDelete": "Bu dönemi silmek istediğine emin misin?",
  "terms.edit": "Düzenle",
  "terms.delete": "Sil",
  "terms.groupCount": "{count} grup",
  "terms.form.month": "Ay",
  "terms.form.monthHelp": "Dönemin ait olduğu ayı seç",
  "terms.form.name": "Ad (opsiyonel)",
  "terms.form.namePlaceholder": "Örn. Ek Dönem",
  "terms.form.create": "Dönem Oluştur",
  "terms.form.edit": "Dönemi Düzenle",
  "terms.form.save": "Kaydet",
  "terms.form.saving": "Kaydediliyor...",
  "terms.form.cancel": "İptal",
  "terms.form.monthRequired": "Ay seçin",

  // Notifications
  "notif.title": "Bildirimler",
  "notif.empty": "Yeni bildirim yok",
  "notif.markAllRead": "Tümünü okundu işaretle",
  "notif.viewAll": "Tümünü gör",
  "notif.mebFailed.title": "MEB işi başarısız",
  "notif.mebFailed.body": "J-2026-0412 numaralı iş hata ile sonuçlandı.",
  "notif.paymentReceived.title": "Tahsilat alındı",
  "notif.paymentReceived.body": "Ayşe Demir — 4.500 ₺ ödeme kayda geçti.",
  "notif.newCandidate.title": "Yeni aday kaydı",
  "notif.newCandidate.body": "Mehmet Yılmaz B sınıfı grubuna eklendi.",
  "notif.time.5m": "5 dk önce",
  "notif.time.1h": "1 saat önce",
  "notif.time.3h": "3 saat önce",
  "notif.time.yesterday": "Dün",
  "notif.time.2d": "2 gün önce",
  "notif.time.3d": "3 gün önce",
  "notif.time.5d": "5 gün önce",

  "notif.documentUploaded.title": "Evrak yüklendi",
  "notif.documentUploaded.body": "Ayşe Demir — Sağlık raporu yüklendi.",
  "notif.groupClosing.title": "Grup kapanışa yaklaşıyor",
  "notif.groupClosing.body": "B Sınıfı - Nisan 2026 grubu kapanışta.",
  "notif.paymentOverdue.title": "Ödeme vadesi geçti",
  "notif.paymentOverdue.body": "3 aday için bakiye tahsilatı bekliyor.",
  "notif.mebApproved.title": "MEB işi onaylandı",
  "notif.mebApproved.body": "J-2026-0398 numaralı iş başarıyla tamamlandı.",
  "notif.trainingAssigned.title": "Eğitim planı atandı",
  "notif.trainingAssigned.body": "Mehmet Yılmaz direksiyon eğitimine atandı.",

  // Notifications page
  "notifPage.title": "Bildirimler",
  "notifPage.tab.all": "Tümü",
  "notifPage.tab.unread": "Okunmamış",
  "notifPage.tab.read": "Okunmuş",
  "notifPage.empty.all": "Hiç bildirim yok.",
  "notifPage.empty.unread": "Okunmamış bildirim yok.",
  "notifPage.empty.read": "Okunmuş bildirim yok.",
  "notifPage.markAllRead": "Tümünü okundu işaretle",

  // User menu + profile
  "userMenu.profile": "Profilim",
  "userMenu.settings": "Hesap Ayarları",
  "userMenu.logout": "Çıkış Yap",
  "profile.title": "Profil",
  "profile.personal": "Kişisel Bilgiler",
  "profile.security": "Güvenlik",
  "profile.preferences": "Tercihler",
  "profile.fullName": "Ad Soyad",
  "profile.email": "E-posta",
  "profile.phone": "Telefon",
  "profile.role": "Rol",
  "profile.institution": "Kurum",
  "profile.joinedAt": "Katılım Tarihi",
  "profile.language": "Dil",
  "profile.changePassword": "Şifre Değiştir",
  "profile.currentPassword": "Mevcut Şifre",
  "profile.newPassword": "Yeni Şifre",
  "profile.confirmPassword": "Yeni Şifre (Tekrar)",
  "profile.updatePassword": "Şifreyi Güncelle",
  "profile.notLoggedIn": "Profilinizi görmek için giriş yapmalısınız.",
  "profile.signIn": "Giriş Yap",
  "profile.saved": "Profil güncellendi",
  "profile.saveFailed": "Profil güncellenemedi",
  "profile.passwordUpdated": "Şifre güncellendi",
  "profile.passwordsDoNotMatch": "Şifreler eşleşmiyor",
  "profile.role.admin": "Yönetici",

  // Documents page
  "documents.title": "Evrak Takibi",
  "documents.tab.missing": "Eksik",
  "documents.tab.all": "Tümü",
  "documents.tab.soon": "Süresi Yaklaşan",
  "documents.searchPlaceholder": "Aday ara (ad, TC)...",
  "documents.filter.allTypes": "Tüm Belge Türleri",
  "documents.filter.allStatuses": "Tüm Durumlar",
  "documents.filter.documentType": "Belge Türü",
  "documents.filter.status": "Durum",
  "documents.col.candidate": "Aday",
  "documents.col.missingDocuments": "Eksik Belgeler",
  "documents.col.documentType": "Belge Türü",
  "documents.col.status": "Durum",
  "documents.col.dueDate": "Son Tarih",
  "documents.col.summary": "Özet",
  "documents.col.action": "İşlem",
  "documents.empty.missing": "Eksik belge bulunmuyor.",
  "documents.empty.soon": "Süresi yaklaşan belge yok.",
  "documents.empty.all": "Henüz belge kaydı yok.",
  "documents.empty.filtered": "Filtrelerle eşleşen belge yok.",
  "documents.action.upload": "Yükle",
  "documents.action.replace": "Değiştir",
  "documents.summary": "{completedCount}/{totalRequiredCount}",
  "documents.loadFailed": "Evraklar yüklenemedi",
  "documents.uploaded": "Evrak yüklendi",
  "documents.uploadFailed": "Evrak yüklenemedi",

  // Candidates page

  // Candidate document summary badge
  "candidateDocs.fraction": "{completed}/{total}",
  "candidateDocs.complete": "Tam",
  "candidateDocs.missing": "{count} eksik",
  "candidateDocs.unknown": "—",
  "candidateDocs.tooltip.complete": "Tüm evraklar tamam",
  "candidateDocs.tooltip.loading": "Yükleniyor...",
  "candidateDocs.tooltip.loadFailed": "Eksik evraklar getirilemedi",
  "candidateDocs.tooltip.missingPlaceholder": "Eksik evrak detayları yakında",
  "candidateDocs.aria.openDetails": "Aday evrak detaylarını aç",

  // Dashboard stat cards
  "stats.activeCandidates": "Aktif Aday",
  "stats.candidatesSub": "Toplam: {count}",
  "stats.missingDocuments": "Eksik Evrak",
  "stats.documentsSub": "zorunlu belge",
  "stats.totalGroups": "Toplam Grup",
  "stats.groupsSub": "Kayıtlı gruplar",
  "stats.mebJobs": "MEB İşleri",
  "stats.mebJobsSub": "{failed} hata · {manual} manuel",

  // Document status labels (pill)
  "documentStatus.missing": "Eksik",
  "documentStatus.uploaded": "Yüklendi",
  "documentStatus.pending": "Beklemede",
  "documentStatus.approved": "Onaylı",
  "documentStatus.rejected": "Reddedildi",
  "documentStatus.expiring_soon": "Süresi Yaklaşıyor",

  // Upload modal
  "uploadDoc.title": "Evrak Yükle",
  "uploadDoc.candidate": "Aday",
  "uploadDoc.candidatePlaceholder": "Aday seç...",
  "uploadDoc.docType": "Belge Türü",
  "uploadDoc.docTypePlaceholder": "Belge türü seç...",
  "uploadDoc.file": "Dosya",
  "uploadDoc.fileHint": "JPEG, PNG veya PDF · maks. 10 MB",
  "uploadDoc.note": "Not",
  "uploadDoc.notePlaceholder": "Opsiyonel",
  "uploadDoc.submit": "Yükle",
  "uploadDoc.submitting": "Yükleniyor...",
  "uploadDoc.cancel": "İptal",
  "uploadDoc.errors.fileRequired": "Dosya seçin",
  "uploadDoc.errors.fileTooLarge": "Dosya 10 MB'tan büyük olamaz",
  "uploadDoc.errors.candidateRequired": "Aday seçin",
  "uploadDoc.errors.docTypeRequired": "Belge türü seçin",
  "uploadDoc.errors.candidatesLoadFailed": "Adaylar yüklenemedi",
  "uploadDoc.errors.typesLoadFailed": "Belge türleri yüklenemedi",

  // Document types admin
  "documentTypes.title": "Belge Türleri",
  "documentTypes.newButton": "Yeni Belge Türü",
  "documentTypes.showInactive": "Pasifleri göster",
  "documentTypes.col.key": "Anahtar",
  "documentTypes.col.name": "Ad",
  "documentTypes.col.sortOrder": "Sıra",
  "documentTypes.col.required": "Zorunlu",
  "documentTypes.col.active": "Durum",
  "documentTypes.col.action": "İşlem",
  "documentTypes.empty": "Henüz belge türü tanımlanmamış.",
  "documentTypes.empty.filtered": "Görüntülenecek belge türü yok.",
  "documentTypes.loadFailed": "Belge türleri yüklenemedi",
  "documentTypes.created": "Belge türü oluşturuldu",
  "documentTypes.updated": "Belge türü güncellendi",
  "documentTypes.saveFailed": "Belge türü kaydedilemedi",
  "documentTypes.active": "Aktif",
  "documentTypes.inactive": "Pasif",
  "documentTypes.required.short": "Evet",
  "documentTypes.notRequired.short": "Hayır",
  "documentTypes.edit": "Düzenle",

  // Document type form modal
  "documentTypeForm.create": "Yeni Belge Türü",
  "documentTypeForm.edit": "Belge Türünü Düzenle",
  "documentTypeForm.module": "Modül",
  "documentTypeForm.key": "Anahtar (key)",
  "documentTypeForm.keyHelp": "Canonical İngilizce, örn. national_id",
  "documentTypeForm.name": "Görünen Ad",
  "documentTypeForm.namePlaceholder": "Nüfus Cüzdanı",
  "documentTypeForm.sortOrder": "Sıra",
  "documentTypeForm.isRequired": "Zorunlu evrak",
  "documentTypeForm.isActive": "Aktif",
  "documentTypeForm.save": "Kaydet",
  "documentTypeForm.saving": "Kaydediliyor...",
  "documentTypeForm.cancel": "İptal",
  "documentTypeForm.errors.keyRequired": "Anahtar gerekli",
  "documentTypeForm.errors.keyFormat": "Sadece küçük harf, rakam ve _ kullanın",
  "documentTypeForm.errors.nameRequired": "Ad gerekli",
  "documentTypeForm.errors.sortOrderInvalid": "0 veya daha büyük olmalı",
};

const en: Record<keyof typeof tr, string> = {
  // Common
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.loading": "Loading...",
  "common.noResults": "No results found",
  "common.prev": "← Previous",
  "common.next": "Next →",
  "common.all": "All",
  "common.close": "Close",
  "common.search": "Search",
  "common.clearFilters": "Clear Filters",

  // Header
  "header.notifications": "Notifications",
  "header.newNotifications": "{count} new notifications",
  "header.menu": "Open menu",
  "header.logout": "Log Out",
  "header.languageToggle": "Change language",

  // Nav
  "nav.main": "Main",
  "nav.operations": "Operations",
  "nav.mebIntegration": "MEB Integration",
  "nav.administration": "Administration",
  "nav.dashboard": "Dashboard",
  "nav.candidates": "Candidates",
  "nav.groups": "Groups",
  "nav.documents": "Documents",
  "nav.documentTypes": "Document Types",
  "nav.payments": "Payments",
  "nav.training": "Training Plan",
  "nav.mebJobs": "MEB Jobs",
  "nav.settings": "Institution Settings",
  "nav.users": "Users",
  "nav.permissions": "Permissions",
  "nav.login": "Sign In",

  // Login
  "login.title": "Pilot",
  "login.subtitle": "Driving school management panel",
  "login.email": "Email",
  "login.password": "Password",
  "login.emailPlaceholder": "user@pilot.com",
  "login.submit": "Sign In",
  "login.submitting": "Signing in...",
  "login.forgotPassword": "Forgot your password?",
  "login.errors.emailRequired": "Email is required",
  "login.errors.passwordRequired": "Password is required",
  "login.errors.failed": "Sign in failed",
  "login.errors.credentialsRequired": "Email and password are required",

  // Forgot password
  "forgot.title": "Forgot Password",
  "forgot.subtitle": "Enter your email and we will send a reset link",
  "forgot.sentTitle": "Reset link sent",
  "forgot.successBody":
    "A reset link has been sent to {email}. Check your inbox. If you cannot find it, look in your spam folder.",
  "forgot.submit": "Send Reset Link",
  "forgot.submitting": "Sending...",
  "forgot.backToLogin": "← Back to sign in",
  "forgot.backToLoginBtn": "Back to Sign In",

  // Groups page
  "groups.title": "Groups",
  "groups.newGroup": "New Group",
  "groups.searchPlaceholder": "Search groups...",
  "groups.view.label": "View",
  "groups.view.cards": "Cards",
  "groups.view.list": "List",
  "groups.filter.allLicenseClasses": "All Classes",
  "groups.filter.allMebStatuses": "All MEB Statuses",
  "groups.filter.licenseClass": "License Class",
  "groups.filter.mebStatus": "MEB Status",
  "groups.empty.noGroupsForTab": "No groups to show.",
  "groups.empty.noMatches": "No groups match the current filters.",
  "groups.empty.noTermSelected": "Select a term to get started.",
  "groups.loadFailed": "Failed to load groups",
  "groups.created": "Group created successfully",

  // Group card fields
  "groups.card.capacity": "Capacity",
  "groups.card.startDate": "Start",
  "groups.card.mebStatus": "MEB Status",
  "groups.table.name": "Group",
  "groups.table.capacity": "Capacity",
  "groups.table.startDate": "Start",
  "groups.table.mebStatus": "MEB Status",

  // Terms
  "terms.title": "Terms",
  "terms.newTerm": "New Term",
  "terms.select": "Select term",
  "terms.selector.label": "Term",
  "terms.selector.none": "— No term selected —",
  "terms.allTerms": "All Terms",
  "terms.loadFailed": "Failed to load terms",
  "terms.created": "Term created",
  "terms.createFailed": "Failed to create term",
  "terms.updated": "Term updated",
  "terms.updateFailed": "Failed to update term",
  "terms.deleted": "Term deleted",
  "terms.deleteFailed": "Failed to delete term",
  "terms.confirmDelete": "Delete this term?",
  "terms.edit": "Edit",
  "terms.delete": "Delete",
  "terms.groupCount": "{count} groups",
  "terms.form.month": "Month",
  "terms.form.monthHelp": "Select the month this term belongs to",
  "terms.form.name": "Name (optional)",
  "terms.form.namePlaceholder": "e.g. Extra Term",
  "terms.form.create": "Create Term",
  "terms.form.edit": "Edit Term",
  "terms.form.save": "Save",
  "terms.form.saving": "Saving...",
  "terms.form.cancel": "Cancel",
  "terms.form.monthRequired": "Select a month",

  // Notifications
  "notif.title": "Notifications",
  "notif.empty": "No new notifications",
  "notif.markAllRead": "Mark all as read",
  "notif.viewAll": "View all",
  "notif.mebFailed.title": "MEB job failed",
  "notif.mebFailed.body": "Job J-2026-0412 ended with an error.",
  "notif.paymentReceived.title": "Payment received",
  "notif.paymentReceived.body": "Ayşe Demir — ₺4,500 payment recorded.",
  "notif.newCandidate.title": "New candidate",
  "notif.newCandidate.body": "Mehmet Yılmaz was added to class B.",
  "notif.time.5m": "5 min ago",
  "notif.time.1h": "1 hour ago",
  "notif.time.3h": "3 hours ago",
  "notif.time.yesterday": "Yesterday",
  "notif.time.2d": "2 days ago",
  "notif.time.3d": "3 days ago",
  "notif.time.5d": "5 days ago",

  "notif.documentUploaded.title": "Document uploaded",
  "notif.documentUploaded.body": "Ayşe Demir — health report uploaded.",
  "notif.groupClosing.title": "Group closing soon",
  "notif.groupClosing.body": "Class B — April 2026 group is closing.",
  "notif.paymentOverdue.title": "Overdue payment",
  "notif.paymentOverdue.body": "3 candidates have pending balances.",
  "notif.mebApproved.title": "MEB job approved",
  "notif.mebApproved.body": "Job J-2026-0398 completed successfully.",
  "notif.trainingAssigned.title": "Training assigned",
  "notif.trainingAssigned.body": "Mehmet Yılmaz was assigned to driving training.",

  // Notifications page
  "notifPage.title": "Notifications",
  "notifPage.tab.all": "All",
  "notifPage.tab.unread": "Unread",
  "notifPage.tab.read": "Read",
  "notifPage.empty.all": "No notifications.",
  "notifPage.empty.unread": "No unread notifications.",
  "notifPage.empty.read": "No read notifications.",
  "notifPage.markAllRead": "Mark all as read",

  // User menu + profile
  "userMenu.profile": "My Profile",
  "userMenu.settings": "Account Settings",
  "userMenu.logout": "Log Out",
  "profile.title": "Profile",
  "profile.personal": "Personal Info",
  "profile.security": "Security",
  "profile.preferences": "Preferences",
  "profile.fullName": "Full Name",
  "profile.email": "Email",
  "profile.phone": "Phone",
  "profile.role": "Role",
  "profile.institution": "Institution",
  "profile.joinedAt": "Joined",
  "profile.language": "Language",
  "profile.changePassword": "Change Password",
  "profile.currentPassword": "Current Password",
  "profile.newPassword": "New Password",
  "profile.confirmPassword": "Confirm New Password",
  "profile.updatePassword": "Update Password",
  "profile.notLoggedIn": "You need to sign in to view your profile.",
  "profile.signIn": "Sign In",
  "profile.saved": "Profile updated",
  "profile.saveFailed": "Profile update failed",
  "profile.passwordUpdated": "Password updated",
  "profile.passwordsDoNotMatch": "Passwords do not match",
  "profile.role.admin": "Administrator",

  // Documents page
  "documents.title": "Documents",
  "documents.tab.missing": "Missing",
  "documents.tab.all": "All",
  "documents.tab.soon": "Due Soon",
  "documents.searchPlaceholder": "Search candidate (name, national ID)...",
  "documents.filter.allTypes": "All Document Types",
  "documents.filter.allStatuses": "All Statuses",
  "documents.filter.documentType": "Document Type",
  "documents.filter.status": "Status",
  "documents.col.candidate": "Candidate",
  "documents.col.missingDocuments": "Missing Documents",
  "documents.col.documentType": "Document Type",
  "documents.col.status": "Status",
  "documents.col.dueDate": "Due Date",
  "documents.col.summary": "Summary",
  "documents.col.action": "Action",
  "documents.empty.missing": "No missing documents.",
  "documents.empty.soon": "No documents due soon.",
  "documents.empty.all": "No documents yet.",
  "documents.empty.filtered": "No documents match the current filters.",
  "documents.action.upload": "Upload",
  "documents.action.replace": "Replace",
  "documents.summary": "{completedCount}/{totalRequiredCount}",
  "documents.loadFailed": "Failed to load documents",
  "documents.uploaded": "Document uploaded",
  "documents.uploadFailed": "Document upload failed",

  // Candidates page

  // Candidate document summary badge
  "candidateDocs.fraction": "{completed}/{total}",
  "candidateDocs.complete": "Complete",
  "candidateDocs.missing": "{count} missing",
  "candidateDocs.unknown": "—",
  "candidateDocs.tooltip.complete": "All documents complete",
  "candidateDocs.tooltip.loading": "Loading...",
  "candidateDocs.tooltip.loadFailed": "Failed to load missing documents",
  "candidateDocs.tooltip.missingPlaceholder": "Missing document details coming soon",
  "candidateDocs.aria.openDetails": "Open candidate document details",

  // Dashboard stat cards
  "stats.activeCandidates": "Active Candidates",
  "stats.candidatesSub": "Total: {count}",
  "stats.missingDocuments": "Missing Documents",
  "stats.documentsSub": "required documents",
  "stats.totalGroups": "Total Groups",
  "stats.groupsSub": "Registered groups",
  "stats.mebJobs": "MEB Jobs",
  "stats.mebJobsSub": "{failed} errors · {manual} manual",

  // Document status labels (pill)
  "documentStatus.missing": "Missing",
  "documentStatus.uploaded": "Uploaded",
  "documentStatus.pending": "Pending",
  "documentStatus.approved": "Approved",
  "documentStatus.rejected": "Rejected",
  "documentStatus.expiring_soon": "Expiring Soon",

  // Upload modal
  "uploadDoc.title": "Upload Document",
  "uploadDoc.candidate": "Candidate",
  "uploadDoc.candidatePlaceholder": "Select a candidate...",
  "uploadDoc.docType": "Document Type",
  "uploadDoc.docTypePlaceholder": "Select a document type...",
  "uploadDoc.file": "File",
  "uploadDoc.fileHint": "JPEG, PNG or PDF · max. 10 MB",
  "uploadDoc.note": "Note",
  "uploadDoc.notePlaceholder": "Optional",
  "uploadDoc.submit": "Upload",
  "uploadDoc.submitting": "Uploading...",
  "uploadDoc.cancel": "Cancel",
  "uploadDoc.errors.fileRequired": "Select a file",
  "uploadDoc.errors.fileTooLarge": "File cannot be larger than 10 MB",
  "uploadDoc.errors.candidateRequired": "Select a candidate",
  "uploadDoc.errors.docTypeRequired": "Select a document type",
  "uploadDoc.errors.candidatesLoadFailed": "Failed to load candidates",
  "uploadDoc.errors.typesLoadFailed": "Failed to load document types",

  // Document types admin
  "documentTypes.title": "Document Types",
  "documentTypes.newButton": "New Document Type",
  "documentTypes.showInactive": "Show inactive",
  "documentTypes.col.key": "Key",
  "documentTypes.col.name": "Name",
  "documentTypes.col.sortOrder": "Order",
  "documentTypes.col.required": "Required",
  "documentTypes.col.active": "Status",
  "documentTypes.col.action": "Action",
  "documentTypes.empty": "No document types defined yet.",
  "documentTypes.empty.filtered": "No document types to show.",
  "documentTypes.loadFailed": "Failed to load document types",
  "documentTypes.created": "Document type created",
  "documentTypes.updated": "Document type updated",
  "documentTypes.saveFailed": "Failed to save document type",
  "documentTypes.active": "Active",
  "documentTypes.inactive": "Inactive",
  "documentTypes.required.short": "Yes",
  "documentTypes.notRequired.short": "No",
  "documentTypes.edit": "Edit",

  // Document type form modal
  "documentTypeForm.create": "New Document Type",
  "documentTypeForm.edit": "Edit Document Type",
  "documentTypeForm.module": "Module",
  "documentTypeForm.key": "Key",
  "documentTypeForm.keyHelp": "Canonical English, e.g. national_id",
  "documentTypeForm.name": "Display Name",
  "documentTypeForm.namePlaceholder": "National ID Card",
  "documentTypeForm.sortOrder": "Order",
  "documentTypeForm.isRequired": "Required document",
  "documentTypeForm.isActive": "Active",
  "documentTypeForm.save": "Save",
  "documentTypeForm.saving": "Saving...",
  "documentTypeForm.cancel": "Cancel",
  "documentTypeForm.errors.keyRequired": "Key is required",
  "documentTypeForm.errors.keyFormat": "Use only lowercase letters, digits and _",
  "documentTypeForm.errors.nameRequired": "Name is required",
  "documentTypeForm.errors.sortOrderInvalid": "Must be 0 or greater",
};

export type TranslationKey = keyof typeof tr;

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { tr, en };

/* ── Context ──────────────────────────────────────────────────── */

type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

function readStoredLang(): Language {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "tr" || raw === "en") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => readStoredLang());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => setLangState(next), []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const template = DICTIONARIES[lang][key] ?? DICTIONARIES[DEFAULT_LANG][key] ?? key;
      return interpolate(template, params);
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

export function useT() {
  return useLanguage().t;
}
