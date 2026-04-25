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
  "common.pageSize": "Sayfa başına",

  // Header
  "header.notifications": "Bildirimler",
  "header.newNotifications": "{count} yeni bildirim",
  "header.menu": "Menüyü aç",
  "header.sidebarToggle": "Sol menüyü aç/kapat",
  "header.logout": "Çıkış Yap",
  "header.languageToggle": "Dili değiştir",

  // Nav / Sidebar
  "nav.main": "Ana",
  "nav.operations": "Operasyon",
  "nav.mebIntegration": "MEB Entegrasyonu",
  "nav.administration": "Yönetim",
  "nav.dashboard": "Kontrol Paneli",
  "nav.candidates": "Adaylar",
  "nav.groups": "Dönemler",
  "nav.documents": "Evrak",
  "nav.documentTypes": "Belge Türleri",
  "nav.payments": "Tahsilat",
  "nav.training": "Eğitim Planı",
  "nav.trainingTeorik": "Teorik Eğitim",
  "nav.trainingUygulama": "Uygulama Eğitim",
  "nav.exams": "Sınavlar",
  "nav.examESinav": "E-Sınav",
  "nav.examUygulama": "Uygulama",
  "nav.mebJobs": "MEB İşleri",
  "nav.settings": "Kurum Ayarları",
  "nav.users": "Kullanıcılar",
  "nav.permissions": "Yetki Yönetimi",
  "nav.login": "Giriş",

  // Exams
  "examESinav.title": "E-Sınav",
  "examESinav.tab.havuz": "Havuz",
  "examESinav.tab.basarisiz": "Başarısız",
  "examESinav.tab.randevulu": "Randevulu",
  "examESinav.sessions.title": "Sınav Oturumları",
  "examESinav.sessions.emptyTitle": "Planlanan oturum yok",
  "examESinav.sessions.emptyDescription":
    "İlk e-sınav randevusu açıldığında aday listesi burada toplanır.",
  "examESinav.candidates.title": "Hazır Adaylar",
  "examESinav.candidates.emptyTitle": "Hazır aday yok",
  "examESinav.candidates.emptyDescription":
    "Evrak ve ödeme adımları tamamlanan adaylar burada görünür.",
  "examUygulama.title": "Uygulama",
  "examUygulama.schedule.title": "Sınav Takvimi",
  "examUygulama.schedule.emptyTitle": "Planlanan sınav yok",
  "examUygulama.schedule.emptyDescription":
    "Uygulama sınav günü tanımlandığında aday atamaları burada listelenir.",
  "examUygulama.boards.title": "Komisyon ve Araç",
  "examUygulama.boards.emptyTitle": "Komisyon ataması yok",
  "examUygulama.boards.emptyDescription":
    "Komisyon, araç ve güzergah bilgileri kesinleştiğinde burada görünür.",

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
  "groups.filter.licenseClass": "Lisans Sınıfı",
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
  "groups.table.licenseClass": "Ehliyet Tipi",
  "groups.table.capacity": "Kontenjan",
  "groups.table.activeCandidates": "Aktif Aday",
  "groups.table.startDate": "Başlangıç",
  "groups.table.mebStatus": "MEB Durumu",
  "groups.table.createdAtUtc": "Kayıt Tarihi",
  "groups.table.updatedAtUtc": "Güncelleme Tarihi",
  "groups.columns.button": "Sütunlar",
  "groups.section.groups": "Grup",
  "groups.section.totalCapacity": "Toplam Kontenjan",
  "groups.section.activeCandidates": "Aktif Aday",

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
  "terms.deleteBlockedActiveGroups": "Dönem silinemiyor. İçinde aktif adayları olan grup var.",
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
  "notif.groupClosing.body": "B Sınıfı - NİSAN 2026 grubu kapanışta.",
  "notif.paymentOverdue.title": "Ödeme vadesi geçti",
  "notif.paymentOverdue.body": "3 aday için bakiye tahsilatı bekliyor.",
  "notif.mebApproved.title": "MEB işi onaylandı",
  "notif.mebApproved.body": "J-2026-0398 numaralı iş başarıyla tamamlandı.",
  "notif.trainingAssigned.title": "Eğitim planı atandı",
  "notif.trainingAssigned.body": "Mehmet Yılmaz uygulama eğitimine atandı.",

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
  "documents.manage.title": "Evrakı Görüntüle / Düzenle",
  "documents.manage.file": "Mevcut Dosya",
  "documents.manage.open": "Belgeyi Aç",
  "documents.manage.replace": "Belgeyi Değiştir",
  "documents.manage.cancelReplace": "Değiştirmeyi İptal Et",
  "documents.manage.newFile": "Yeni Dosya",
  "documents.manage.replaceHint": "Yeni dosya seçersen kaydederken mevcut evrak bununla değiştirilir.",
  "documents.manage.notFound": "Belge kaydı bulunamadı.",
  "documents.manage.loadFailed": "Belge detayları yüklenemedi",
  "documents.manage.saveFailed": "Belge güncellenemedi",
  "documents.manage.saved": "Evrak bilgileri güncellendi",
  "documents.manage.saving": "Kaydediliyor...",

  // Candidates page

  // Candidates table columns
  "candidates.col.name": "Ad Soyad",
  "candidates.col.photo": "Resim",
  "candidates.col.nationalId": "TC Kimlik",
  "candidates.col.phoneNumber": "Telefon",
  "candidates.col.email": "E-posta",
  "candidates.col.birthDate": "Doğum Tarihi",
  "candidates.col.gender": "Cinsiyet",
  "candidates.col.licenseClass": "Ehliyet Tipi",
  "candidates.col.term": "Dönem",
  "candidates.col.group": "Grup",
  "candidates.col.groupStartDate": "Grup Başlangıç",
  "candidates.col.eSinavDate": "E-Sınav Tarihi",
  "candidates.col.eSinavAttemptCount": "E-Sınav Hakkı",
  "candidates.col.drivingExamDate": "Uygulama Tarihi",
  "candidates.col.drivingExamAttemptCount": "Uygulama Hakkı",
  "candidates.col.documents": "Evrak",
  "candidates.col.missingDocuments": "Eksik Evrak",
  "candidates.col.mebSyncStatus": "Mebbis",
  "candidates.col.examFeePaid": "Sınav Ücreti",
  "candidates.col.balance": "Bakiye",
  "candidates.col.status": "Durum",
  "candidates.col.createdAtUtc": "Kayıt Tarihi",
  "candidates.col.updatedAtUtc": "Güncelleme Tarihi",
  "candidates.columns.button": "Sütunlar",
  "candidates.tags.label": "Etiketler",
  "candidates.tags.placeholder": "Etiket ara veya yeni oluştur",
  "candidates.tags.createNew": "Yeni:",
  "candidates.tags.noMatches": "Eşleşen etiket yok",
  "candidates.tags.loading": "Yükleniyor...",
  "candidates.tags.remove": "{name} etiketini kaldır",
  "candidates.tags.addFilter": "Yeni Etiket",
  "candidates.tags.newFilterPlaceholder": "Etiket adı",
  "candidates.filters.button": "Filtreler",
  "candidates.filters.clear": "Filtreleri Temizle",
  "candidates.filters.firstName": "Ad",
  "candidates.filters.lastName": "Soyad",
  "candidates.filters.rangeFrom": "Başlangıç",
  "candidates.filters.rangeTo": "Bitiş",
  "candidates.filters.min": "Min",
  "candidates.filters.max": "Max",
  "candidates.filters.yes": "Var",
  "candidates.filters.no": "Yok",
  "candidates.filters.groupPlaceholder": "örn. 1B",
  "candidates.filters.hasActiveGroup": "Aktif Grubu Var",
  "candidates.filters.hasPhoto": "Fotoğrafı Var",
  "candidates.filters.hasExamResult": "Sınav Sonucu Var",
  "candidates.filters.examFeePaid": "Sınav Ücreti",
  "candidates.filters.hasMissingDocuments": "Eksik Evrak Var",
  "candidates.examFee.all": "Tüm Ücretler",
  "candidates.examFee.paid": "Ücreti Ödendi",
  "candidates.examFee.unpaid": "Ücreti Ödenmedi",
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
  "uploadDoc.errors.metadataRequired": "{label} alanı gerekli",
  "uploadDoc.metadataSelectPlaceholder": "Seçin...",

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
  "documentTypeForm.metadataTitle": "Ek Alanlar",
  "documentTypeForm.metadataHint":
    "Bu belge türü yüklenirken kullanıcıdan toplanacak ek veriler.",
  "documentTypeForm.metadataEmpty":
    "Bu belge türü ek veri toplamıyor. Alan eklemek için butonu kullanın.",
  "documentTypeForm.addField": "Alan Ekle",
  "documentTypeForm.removeField": "Kaldır",
  "documentTypeForm.moveUp": "Yukarı taşı",
  "documentTypeForm.moveDown": "Aşağı taşı",
  "documentTypeForm.fieldKey": "Anahtar",
  "documentTypeForm.fieldLabel": "Etiket",
  "documentTypeForm.fieldLabelPlaceholder": "Örn. Veriliş Tarihi",
  "documentTypeForm.fieldType": "Tip",
  "documentTypeForm.fieldRequired": "Zorunlu",
  "documentTypeForm.fieldPlaceholder": "Placeholder",
  "documentTypeForm.fieldTypeText": "Metin",
  "documentTypeForm.fieldTypeDate": "Tarih",
  "documentTypeForm.fieldTypeSelect": "Seçim",
  "documentTypeForm.fieldOptions": "Seçenekler",
  "documentTypeForm.addOption": "Seçenek Ekle",
  "documentTypeForm.optionValue": "Değer",
  "documentTypeForm.optionLabel": "Görünen",
  "documentTypeForm.optionsEmpty": "En az bir seçenek ekleyin.",
  "documentTypeForm.errors.fieldKeyRequired": "Alan anahtarı gerekli",
  "documentTypeForm.errors.fieldKeyFormat":
    "Alan anahtarı sadece küçük harf, rakam ve _ içerebilir",
  "documentTypeForm.errors.fieldKeyDuplicate": "Aynı alan anahtarı iki kez kullanılmış",
  "documentTypeForm.errors.fieldLabelRequired": "Alan etiketi gerekli",
  "documentTypeForm.errors.selectOptionsRequired": "Seçim alanı için en az bir seçenek ekleyin",
  "documentTypeForm.errors.optionFieldsRequired": "Tüm seçeneklerin değer ve görüneni olmalı",
  "documentTypeForm.errors.optionValueDuplicate": "Aynı seçenek değeri iki kez kullanılmış",

  // Vehicle validation (returned by VehiclesController as errorCodes)
  "vehicle.validation.required": "Bu alan boş bırakılamaz",
  "vehicle.validation.invalidPlate": "Plaka {min} ile {max} karakter arasında olmalı",
  "vehicle.validation.invalidModelYear": "Model yılı {min} ile {max} arasında olmalı",
  "vehicle.validation.invalidOdometer": "Kilometre / saat değeri negatif olamaz",
  "vehicle.validation.invalidCatalogValue": "Desteklenen değerler: {values}",
  "vehicle.validation.invalidLicenseClass": "Desteklenen değerler: {values}",
  "vehicle.validation.invalidSortField": "Sıralama alanı geçerli değil",
  "vehicle.validation.invalidSortDirection": "Sıralama yönü geçerli değil",
  "vehicle.validation.invalidActivityFilter": "Desteklenen değerler: {values}",
  "vehicle.validation.plateConflict": "Bu plakayla başka bir araç zaten kayıtlı",
  "vehicle.validation.rowVersionRequired": "Kayıt sürümü zorunlu",
  "vehicle.validation.concurrencyConflict":
    "Bu kayıt başka bir kullanıcı tarafından güncellendi. Formu kapatıp güncel veriyle tekrar deneyin.",
  "vehicle.validation.generic": "Araç kaydı sırasında hata oluştu",

  // Instructor validation (returned by InstructorsController as errorCodes)
  "instructor.validation.required": "Bu alan boş bırakılamaz",
  "instructor.validation.invalidCode": "Personel kodu {min} ile {max} karakter arasında olmalı",
  "instructor.validation.invalidNationalId": "TC kimlik no 11 haneli olmalı",
  "instructor.validation.invalidWeeklyLessonHours":
    "Haftalık ders saati {min} ile {max} arasında olmalı",
  "instructor.validation.invalidCatalogValue": "Desteklenen değerler: {values}",
  "instructor.validation.invalidCollection": "Desteklenen değerler: {values}",
  "instructor.validation.invalidLicenseClass": "Desteklenen değerler: {values}",
  "instructor.validation.invalidAssignedVehicle": "Atanan araç bulunamadı",
  "instructor.validation.invalidSortField": "Sıralama alanı geçerli değil",
  "instructor.validation.invalidSortDirection": "Sıralama yönü geçerli değil",
  "instructor.validation.invalidActivityFilter": "Desteklenen değerler: {values}",
  "instructor.validation.codeConflict": "Bu personel koduyla başka bir eğitmen zaten kayıtlı",
  "instructor.validation.nationalIdConflict":
    "Bu TC kimlik no ile başka bir eğitmen zaten kayıtlı",
  "instructor.validation.uniqueConflict": "Personel kodu veya TC kimlik no zaten kullanılıyor",
  "instructor.validation.rowVersionRequired": "Kayıt sürümü zorunlu",
  "instructor.validation.concurrencyConflict":
    "Bu kayıt başka bir kullanıcı tarafından güncellendi. Formu kapatıp güncel veriyle tekrar deneyin.",
  "instructor.validation.generic": "Eğitmen kaydı sırasında hata oluştu",

  // Route validation (returned by RoutesController as errorCodes)
  "route.validation.required": "Bu alan boş bırakılamaz",
  "route.validation.invalidCode": "Güzergah kodu {min} ile {max} karakter arasında olmalı",
  "route.validation.invalidCatalogValue": "Desteklenen değerler: {values}",
  "route.validation.invalidDistance": "Mesafe {min} ile {max} km arasında olmalı",
  "route.validation.invalidDuration": "Süre {min} ile {max} dakika arasında olmalı",
  "route.validation.invalidSortField": "Sıralama alanı geçerli değil",
  "route.validation.invalidSortDirection": "Sıralama yönü geçerli değil",
  "route.validation.invalidActivityFilter": "Desteklenen değerler: {values}",
  "route.validation.codeConflict": "Bu kodla başka bir güzergah zaten kayıtlı",
  "route.validation.rowVersionRequired": "Kayıt sürümü zorunlu",
  "route.validation.concurrencyConflict":
    "Bu kayıt başka bir kullanıcı tarafından güncellendi. Formu kapatıp güncel veriyle tekrar deneyin.",
  "route.validation.generic": "Güzergah kaydı sırasında hata oluştu",

  // Area validation (returned by AreasController as errorCodes)
  "area.validation.required": "Bu alan boş bırakılamaz",
  "area.validation.invalidCode": "Alan kodu {min} ile {max} karakter arasında olmalı",
  "area.validation.invalidCatalogValue": "Desteklenen değerler: {values}",
  "area.validation.invalidCapacity": "Kapasite {min} ile {max} arasında olmalı",
  "area.validation.invalidSortField": "Sıralama alanı geçerli değil",
  "area.validation.invalidSortDirection": "Sıralama yönü geçerli değil",
  "area.validation.invalidActivityFilter": "Desteklenen değerler: {values}",
  "area.validation.codeConflict": "Bu kodla başka bir alan zaten kayıtlı",
  "area.validation.rowVersionRequired": "Kayıt sürümü zorunlu",
  "area.validation.concurrencyConflict":
    "Bu kayıt başka bir kullanıcı tarafından güncellendi. Formu kapatıp güncel veriyle tekrar deneyin.",
  "area.validation.generic": "Alan kaydı sırasında hata oluştu",

  // License class definition validation
  "licenseClassDefinition.validation.required": "Bu alan boş bırakılamaz",
  "licenseClassDefinition.validation.invalidCode":
    "Ehliyet tipi kodu {min} ile {max} karakter arasında olmalı",
  "licenseClassDefinition.validation.invalidCatalogValue": "Desteklenen değerler: {values}",
  "licenseClassDefinition.validation.invalidSortField": "Sıralama alanı geçerli değil",
  "licenseClassDefinition.validation.invalidSortDirection": "Sıralama yönü geçerli değil",
  "licenseClassDefinition.validation.invalidActivityFilter": "Desteklenen değerler: {values}",
  "licenseClassDefinition.validation.invalidAge": "Yaş şartı {min} ile {max} arasında olmalı",
  "licenseClassDefinition.validation.invalidHours": "Ders saati {min} ile {max} arasında olmalı",
  "licenseClassDefinition.validation.invalidFee": "Ücret {min} ile {max} arasında olmalı",
  "licenseClassDefinition.validation.invalidDisplayOrder":
    "Sıralama {min} ile {max} arasında olmalı",
  "licenseClassDefinition.validation.codeConflict":
    "Bu kodla başka bir ehliyet tipi zaten kayıtlı",
  "licenseClassDefinition.validation.rowVersionRequired": "Kayıt sürümü zorunlu",
  "licenseClassDefinition.validation.concurrencyConflict":
    "Bu kayıt başka bir kullanıcı tarafından güncellendi. Formu kapatıp güncel veriyle tekrar deneyin.",
  "licenseClassDefinition.validation.generic": "Ehliyet tipi kaydı sırasında hata oluştu",

  // Candidate validation (returned by CandidatesController as errorCodes)
  "candidate.validation.required": "Bu alan boş bırakılamaz",
  "candidate.validation.tagNameRequired": "Etiket adı zorunlu",
  "candidate.validation.invalidLicenseClass": "Desteklenen değerler: {values}",
  "candidate.validation.invalidStatus": "Desteklenen değerler: {values}",
  "candidate.validation.invalidMebSyncStatus": "Desteklenen değerler: {values}",
  "candidate.validation.invalidGender": "Desteklenen değerler: {values}",
  "candidate.validation.invalidESinavTab": "Desteklenen değerler: havuz, basarisiz, randevulu",
  "candidate.validation.invalidExamDateType": "Desteklenen değerler: e_sinav, uygulama",
  "candidate.validation.invalidExistingLicenseType": "Geçersiz mevcut ehliyet türü",
  "candidate.validation.invalidExamAttemptCount":
    "Sınav hakkı {min} ile {max} arasında olmalı",
  "candidate.validation.eSinavRescheduleLimit":
    "E-Sınav için {max} hak doldu. Yeni sınav tarihi atanamaz.",
  "candidate.validation.existingLicenseConsistency":
    "Mevcut ehliyet alanları birbirini tamamlamalı",
  "candidate.validation.invalidSortField": "Sıralama alanı geçerli değil",
  "candidate.validation.invalidSortDirection": "Sıralama yönü geçerli değil",
  "candidate.validation.invalidTag": "Etiket geçersiz",
  "candidate.validation.nationalIdConflict": "Bu TC kimlik numarası zaten kayıtlı",
  "candidate.validation.rowVersionRequired": "Kayıt sürümü zorunlu",
  "candidate.validation.concurrencyConflict":
    "Bu aday başka bir kullanıcı tarafından güncellendi. Lütfen listeye dönüp tekrar açın.",
  "candidate.validation.generic": "Aday kaydı sırasında hata oluştu",

  // Group validation (returned by GroupsController as errorCodes)
  "group.validation.required": "Bu alan boş bırakılamaz",
  "group.validation.invalidGroupNumber": "Grup numarası {min} ile {max} arasında olmalı",
  "group.validation.invalidGroupBranch": "Grup şubesi A ile Z arasında tek harf olmalı",
  "group.validation.invalidMebStatus": "Desteklenen değerler: {values}",
  "group.validation.termNotFound": "Seçilen dönem bulunamadı",
  "group.validation.startDateOutsideTerm": "Başlangıç tarihi seçilen dönem ayının içinde olmalı",
  "group.validation.hasActiveCandidates": "Aktif adayı olan grup silinemez",
  "group.validation.rowVersionRequired": "Kayıt sürümü zorunlu",
  "group.validation.concurrencyConflict":
    "Bu grup başka bir kullanıcı tarafından güncellendi. Formu kapatıp güncel veriyle tekrar deneyin.",
  "group.validation.generic": "Grup kaydı sırasında hata oluştu",

  // Term validation (returned by TermsController as errorCodes)
  "term.validation.nameRequired": "Aynı ayda başka bir dönem varken ad zorunlu",
  "term.validation.hasActiveCandidates":
    "İçinde aktif adayları olan grubu bulunan dönem silinemez",
  "term.validation.rowVersionRequired": "Kayıt sürümü zorunlu",
  "term.validation.concurrencyConflict":
    "Bu dönem başka bir kullanıcı tarafından güncellendi. Formu kapatıp güncel veriyle tekrar deneyin.",
  "term.validation.generic": "Dönem kaydı sırasında hata oluştu",
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
  "common.pageSize": "Per page",

  // Header
  "header.notifications": "Notifications",
  "header.newNotifications": "{count} new notifications",
  "header.menu": "Open menu",
  "header.sidebarToggle": "Open or close sidebar",
  "header.logout": "Log Out",
  "header.languageToggle": "Change language",

  // Nav
  "nav.main": "Main",
  "nav.operations": "Operations",
  "nav.mebIntegration": "MEB Integration",
  "nav.administration": "Administration",
  "nav.dashboard": "Dashboard",
  "nav.candidates": "Candidates",
  "nav.groups": "Terms",
  "nav.documents": "Documents",
  "nav.documentTypes": "Document Types",
  "nav.payments": "Payments",
  "nav.training": "Training Plan",
  "nav.trainingTeorik": "Theory Training",
  "nav.trainingUygulama": "Practice Training",
  "nav.exams": "Exams",
  "nav.examESinav": "E-Exam",
  "nav.examUygulama": "Driving",
  "nav.mebJobs": "MEB Jobs",
  "nav.settings": "Institution Settings",
  "nav.users": "Users",
  "nav.permissions": "Permissions",
  "nav.login": "Sign In",

  // Exams
  "examESinav.title": "E-Exam",
  "examESinav.tab.havuz": "Pool",
  "examESinav.tab.basarisiz": "Failed",
  "examESinav.tab.randevulu": "Scheduled",
  "examESinav.sessions.title": "Exam Sessions",
  "examESinav.sessions.emptyTitle": "No session planned",
  "examESinav.sessions.emptyDescription":
    "Scheduled e-exam appointments will appear here as soon as the first session is opened.",
  "examESinav.candidates.title": "Ready Candidates",
  "examESinav.candidates.emptyTitle": "No candidate is ready",
  "examESinav.candidates.emptyDescription":
    "Candidates who completed their document and payment steps will appear here.",
  "examUygulama.title": "Driving",
  "examUygulama.schedule.title": "Exam Schedule",
  "examUygulama.schedule.emptyTitle": "No exam planned",
  "examUygulama.schedule.emptyDescription":
    "Candidate assignments will appear here when a driving exam day is scheduled.",
  "examUygulama.boards.title": "Board and Vehicle",
  "examUygulama.boards.emptyTitle": "No board assigned",
  "examUygulama.boards.emptyDescription":
    "Board, vehicle and route details will appear here once they are finalized.",

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
  "groups.filter.licenseClass": "License Class",
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
  "groups.table.licenseClass": "License Type",
  "groups.table.capacity": "Capacity",
  "groups.table.activeCandidates": "Active Candidates",
  "groups.table.startDate": "Start",
  "groups.table.mebStatus": "MEB Status",
  "groups.table.createdAtUtc": "Created At",
  "groups.table.updatedAtUtc": "Updated At",
  "groups.columns.button": "Columns",
  "groups.section.groups": "Groups",
  "groups.section.totalCapacity": "Total Capacity",
  "groups.section.activeCandidates": "Active Candidates",

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
  "terms.deleteBlockedActiveGroups": "Term cannot be deleted because it still contains a group with active candidates.",
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
  "documents.manage.title": "View / Edit Document",
  "documents.manage.file": "Current File",
  "documents.manage.open": "Open Document",
  "documents.manage.replace": "Replace Document",
  "documents.manage.cancelReplace": "Cancel Replace",
  "documents.manage.newFile": "New File",
  "documents.manage.replaceHint": "If you select a new file, saving will replace the current document.",
  "documents.manage.notFound": "Document record was not found.",
  "documents.manage.loadFailed": "Failed to load document details",
  "documents.manage.saveFailed": "Document could not be updated",
  "documents.manage.saved": "Document details updated",
  "documents.manage.saving": "Saving...",

  // Candidates page

  // Candidates table columns
  "candidates.col.name": "Full Name",
  "candidates.col.photo": "Photo",
  "candidates.col.nationalId": "National ID",
  "candidates.col.phoneNumber": "Phone",
  "candidates.col.email": "Email",
  "candidates.col.birthDate": "Birth Date",
  "candidates.col.gender": "Gender",
  "candidates.col.licenseClass": "License Type",
  "candidates.col.term": "Term",
  "candidates.col.group": "Group",
  "candidates.col.groupStartDate": "Group Start",
  "candidates.col.eSinavDate": "E-Exam Date",
  "candidates.col.eSinavAttemptCount": "E-Exam Attempts",
  "candidates.col.drivingExamDate": "Driving Exam Date",
  "candidates.col.drivingExamAttemptCount": "Driving Attempts",
  "candidates.col.documents": "Documents",
  "candidates.col.missingDocuments": "Missing Docs",
  "candidates.col.mebSyncStatus": "Mebbis",
  "candidates.col.examFeePaid": "Exam Fee",
  "candidates.col.balance": "Balance",
  "candidates.col.status": "Status",
  "candidates.col.createdAtUtc": "Created At",
  "candidates.col.updatedAtUtc": "Updated At",
  "candidates.columns.button": "Columns",
  "candidates.tags.label": "Tags",
  "candidates.tags.placeholder": "Search or create a tag",
  "candidates.tags.createNew": "Create:",
  "candidates.tags.noMatches": "No matching tags",
  "candidates.tags.loading": "Loading...",
  "candidates.tags.remove": "Remove tag {name}",
  "candidates.tags.addFilter": "New Tag",
  "candidates.tags.newFilterPlaceholder": "Tag name",
  "candidates.filters.button": "Filters",
  "candidates.filters.clear": "Clear Filters",
  "candidates.filters.firstName": "First Name",
  "candidates.filters.lastName": "Last Name",
  "candidates.filters.rangeFrom": "From",
  "candidates.filters.rangeTo": "To",
  "candidates.filters.min": "Min",
  "candidates.filters.max": "Max",
  "candidates.filters.yes": "Yes",
  "candidates.filters.no": "No",
  "candidates.filters.groupPlaceholder": "e.g. 1B",
  "candidates.filters.hasActiveGroup": "Has Active Group",
  "candidates.filters.hasPhoto": "Has Photo",
  "candidates.filters.hasExamResult": "Has Exam Result",
  "candidates.filters.examFeePaid": "Exam Fee",
  "candidates.filters.hasMissingDocuments": "Has Missing Docs",
  "candidates.examFee.all": "All Fees",
  "candidates.examFee.paid": "Fee Paid",
  "candidates.examFee.unpaid": "Fee Unpaid",
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
  "uploadDoc.errors.metadataRequired": "{label} is required",
  "uploadDoc.metadataSelectPlaceholder": "Select...",

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
  "documentTypeForm.metadataTitle": "Extra Fields",
  "documentTypeForm.metadataHint":
    "Additional data collected from the user when uploading this document type.",
  "documentTypeForm.metadataEmpty":
    "This document type does not collect extra data. Click the button to add a field.",
  "documentTypeForm.addField": "Add Field",
  "documentTypeForm.removeField": "Remove",
  "documentTypeForm.moveUp": "Move up",
  "documentTypeForm.moveDown": "Move down",
  "documentTypeForm.fieldKey": "Key",
  "documentTypeForm.fieldLabel": "Label",
  "documentTypeForm.fieldLabelPlaceholder": "e.g. Issued At",
  "documentTypeForm.fieldType": "Type",
  "documentTypeForm.fieldRequired": "Required",
  "documentTypeForm.fieldPlaceholder": "Placeholder",
  "documentTypeForm.fieldTypeText": "Text",
  "documentTypeForm.fieldTypeDate": "Date",
  "documentTypeForm.fieldTypeSelect": "Select",
  "documentTypeForm.fieldOptions": "Options",
  "documentTypeForm.addOption": "Add Option",
  "documentTypeForm.optionValue": "Value",
  "documentTypeForm.optionLabel": "Label",
  "documentTypeForm.optionsEmpty": "Add at least one option.",
  "documentTypeForm.errors.fieldKeyRequired": "Field key is required",
  "documentTypeForm.errors.fieldKeyFormat":
    "Field key may only contain lowercase letters, digits and _",
  "documentTypeForm.errors.fieldKeyDuplicate": "Field key is used twice",
  "documentTypeForm.errors.fieldLabelRequired": "Field label is required",
  "documentTypeForm.errors.selectOptionsRequired":
    "A select field requires at least one option",
  "documentTypeForm.errors.optionFieldsRequired":
    "All options must have a value and a label",
  "documentTypeForm.errors.optionValueDuplicate": "Option value is used twice",

  // Vehicle validation (returned by VehiclesController as errorCodes)
  "vehicle.validation.required": "This field is required",
  "vehicle.validation.invalidPlate": "Plate must be between {min} and {max} characters",
  "vehicle.validation.invalidModelYear": "Model year must be between {min} and {max}",
  "vehicle.validation.invalidOdometer": "Odometer value cannot be negative",
  "vehicle.validation.invalidCatalogValue": "Supported values: {values}",
  "vehicle.validation.invalidLicenseClass": "Supported values: {values}",
  "vehicle.validation.invalidSortField": "Sort field is not valid",
  "vehicle.validation.invalidSortDirection": "Sort direction is not valid",
  "vehicle.validation.invalidActivityFilter": "Supported values: {values}",
  "vehicle.validation.plateConflict": "Another vehicle already uses this plate",
  "vehicle.validation.rowVersionRequired": "Row version is required",
  "vehicle.validation.concurrencyConflict":
    "This record was updated by someone else. Close the form and try again with the latest data.",
  "vehicle.validation.generic": "Something went wrong while saving the vehicle",

  // Instructor validation (returned by InstructorsController as errorCodes)
  "instructor.validation.required": "This field is required",
  "instructor.validation.invalidCode":
    "Instructor code must be between {min} and {max} characters",
  "instructor.validation.invalidNationalId": "National id must be exactly 11 digits",
  "instructor.validation.invalidWeeklyLessonHours":
    "Weekly lesson hours must be between {min} and {max}",
  "instructor.validation.invalidCatalogValue": "Supported values: {values}",
  "instructor.validation.invalidCollection": "Supported values: {values}",
  "instructor.validation.invalidLicenseClass": "Supported values: {values}",
  "instructor.validation.invalidAssignedVehicle": "Assigned vehicle was not found",
  "instructor.validation.invalidSortField": "Sort field is not valid",
  "instructor.validation.invalidSortDirection": "Sort direction is not valid",
  "instructor.validation.invalidActivityFilter": "Supported values: {values}",
  "instructor.validation.codeConflict": "Another instructor already uses this code",
  "instructor.validation.nationalIdConflict":
    "Another instructor already uses this national id",
  "instructor.validation.uniqueConflict": "Instructor code or national id is already in use",
  "instructor.validation.rowVersionRequired": "Row version is required",
  "instructor.validation.concurrencyConflict":
    "This record was updated by someone else. Close the form and try again with the latest data.",
  "instructor.validation.generic": "Something went wrong while saving the instructor",

  // Route validation (returned by RoutesController as errorCodes)
  "route.validation.required": "This field is required",
  "route.validation.invalidCode": "Route code must be between {min} and {max} characters",
  "route.validation.invalidCatalogValue": "Supported values: {values}",
  "route.validation.invalidDistance": "Distance must be between {min} and {max} km",
  "route.validation.invalidDuration": "Duration must be between {min} and {max} minutes",
  "route.validation.invalidSortField": "Sort field is not valid",
  "route.validation.invalidSortDirection": "Sort direction is not valid",
  "route.validation.invalidActivityFilter": "Supported values: {values}",
  "route.validation.codeConflict": "Another route already uses this code",
  "route.validation.rowVersionRequired": "Row version is required",
  "route.validation.concurrencyConflict":
    "This record was updated by someone else. Close the form and try again with the latest data.",
  "route.validation.generic": "Something went wrong while saving the route",

  // Area validation (returned by AreasController as errorCodes)
  "area.validation.required": "This field is required",
  "area.validation.invalidCode": "Area code must be between {min} and {max} characters",
  "area.validation.invalidCatalogValue": "Supported values: {values}",
  "area.validation.invalidCapacity": "Capacity must be between {min} and {max}",
  "area.validation.invalidSortField": "Sort field is not valid",
  "area.validation.invalidSortDirection": "Sort direction is not valid",
  "area.validation.invalidActivityFilter": "Supported values: {values}",
  "area.validation.codeConflict": "Another area already uses this code",
  "area.validation.rowVersionRequired": "Row version is required",
  "area.validation.concurrencyConflict":
    "This record was updated by someone else. Close the form and try again with the latest data.",
  "area.validation.generic": "Something went wrong while saving the area",

  // License class definition validation
  "licenseClassDefinition.validation.required": "This field is required",
  "licenseClassDefinition.validation.invalidCode":
    "License class code must be between {min} and {max} characters",
  "licenseClassDefinition.validation.invalidCatalogValue": "Supported values: {values}",
  "licenseClassDefinition.validation.invalidSortField": "Sort field is not valid",
  "licenseClassDefinition.validation.invalidSortDirection": "Sort direction is not valid",
  "licenseClassDefinition.validation.invalidActivityFilter": "Supported values: {values}",
  "licenseClassDefinition.validation.invalidAge":
    "Minimum age must be between {min} and {max}",
  "licenseClassDefinition.validation.invalidHours":
    "Lesson hours must be between {min} and {max}",
  "licenseClassDefinition.validation.invalidFee": "Fee must be between {min} and {max}",
  "licenseClassDefinition.validation.invalidDisplayOrder":
    "Display order must be between {min} and {max}",
  "licenseClassDefinition.validation.codeConflict":
    "Another license class already uses this code",
  "licenseClassDefinition.validation.rowVersionRequired": "Row version is required",
  "licenseClassDefinition.validation.concurrencyConflict":
    "This record was updated by someone else. Close the form and try again with the latest data.",
  "licenseClassDefinition.validation.generic":
    "Something went wrong while saving the license class",

  // Candidate validation (returned by CandidatesController as errorCodes)
  "candidate.validation.required": "This field is required",
  "candidate.validation.tagNameRequired": "Tag name is required",
  "candidate.validation.invalidLicenseClass": "Supported values: {values}",
  "candidate.validation.invalidStatus": "Supported values: {values}",
  "candidate.validation.invalidMebSyncStatus": "Supported values: {values}",
  "candidate.validation.invalidGender": "Supported values: {values}",
  "candidate.validation.invalidESinavTab": "Supported values: havuz, basarisiz, randevulu",
  "candidate.validation.invalidExamDateType": "Supported values: e_sinav, uygulama",
  "candidate.validation.invalidExistingLicenseType": "Existing license type is invalid",
  "candidate.validation.invalidExamAttemptCount":
    "Exam attempt count must be between {min} and {max}",
  "candidate.validation.eSinavRescheduleLimit":
    "E-Sinav attempt limit reached ({max}). Cannot assign a new exam date.",
  "candidate.validation.existingLicenseConsistency":
    "Existing license fields must be provided together",
  "candidate.validation.invalidSortField": "Sort field is not valid",
  "candidate.validation.invalidSortDirection": "Sort direction is not valid",
  "candidate.validation.invalidTag": "Tag is invalid",
  "candidate.validation.nationalIdConflict": "This national ID is already registered",
  "candidate.validation.rowVersionRequired": "Row version is required",
  "candidate.validation.concurrencyConflict":
    "This candidate was updated by someone else. Return to the list and reopen to retry.",
  "candidate.validation.generic": "Something went wrong while saving the candidate",

  // Group validation (returned by GroupsController as errorCodes)
  "group.validation.required": "This field is required",
  "group.validation.invalidGroupNumber": "Group number must be between {min} and {max}",
  "group.validation.invalidGroupBranch": "Group branch must be a single letter between A and Z",
  "group.validation.invalidMebStatus": "Supported values: {values}",
  "group.validation.termNotFound": "Selected term was not found",
  "group.validation.startDateOutsideTerm": "Start date must be inside the selected term month",
  "group.validation.hasActiveCandidates": "Group cannot be deleted while it still has active candidates",
  "group.validation.rowVersionRequired": "Row version is required",
  "group.validation.concurrencyConflict":
    "This group was updated by someone else. Close the form and try again with the latest data.",
  "group.validation.generic": "Something went wrong while saving the group",

  // Term validation (returned by TermsController as errorCodes)
  "term.validation.nameRequired": "Name is required when another term already exists in the same month",
  "term.validation.hasActiveCandidates":
    "Term cannot be deleted while it still has groups with active candidates",
  "term.validation.rowVersionRequired": "Row version is required",
  "term.validation.concurrencyConflict":
    "This term was updated by someone else. Close the form and try again with the latest data.",
  "term.validation.generic": "Something went wrong while saving the term",
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
