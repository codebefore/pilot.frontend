import { Drawer, DrawerRow, DrawerSection } from "../ui/Drawer";
import { StatusPill } from "../ui/StatusPill";
import { formatBalance, type Candidate } from "../../mock/candidates";

type CandidateDrawerProps = {
  candidate: Candidate | null;
  onClose: () => void;
  onStartMebJob: () => void;
  onTakePayment: () => void;
};

/* Mock detail fields (T023 backend detayı gelene kadar). */
const MOCK_DETAIL = {
  birthDate: "15.06.1998",
  phone:     "0555 123 45 67",
  email:     "aday@mail.com",
  enrolledAt:"28.03.2026",
  trainingPlan: "Atandı",
  totalFee: 4800,
  paid:     2400,
};

export function CandidateDrawer({
  candidate,
  onClose,
  onStartMebJob,
  onTakePayment,
}: CandidateDrawerProps) {
  if (!candidate) return null;

  const remaining = MOCK_DETAIL.totalFee - MOCK_DETAIL.paid;

  return (
    <Drawer
      actions={
        <>
          <button className="btn btn-primary btn-sm" onClick={onStartMebJob} type="button">
            MEB İşi Başlat
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onTakePayment} type="button">
            Tahsilat Al
          </button>
          <button className="btn btn-secondary btn-sm" type="button">
            Evrak Yükle
          </button>
        </>
      }
      onClose={onClose}
      open
      title={candidate.fullName}
    >
      <DrawerSection title="Kişisel Bilgiler">
        <DrawerRow label="TC Kimlik">{candidate.tc}</DrawerRow>
        <DrawerRow label="Doğum Tarihi">{MOCK_DETAIL.birthDate}</DrawerRow>
        <DrawerRow label="Telefon">{MOCK_DETAIL.phone}</DrawerRow>
        <DrawerRow label="E-posta">{MOCK_DETAIL.email}</DrawerRow>
      </DrawerSection>

      <DrawerSection title="Kayıt Bilgileri">
        <DrawerRow label="Sınıf">
          <span className="cand-class-badge">{candidate.className}</span>
        </DrawerRow>
        <DrawerRow label="Grup">{candidate.term}</DrawerRow>
        <DrawerRow label="Kayıt Tarihi">{MOCK_DETAIL.enrolledAt}</DrawerRow>
        <DrawerRow label="Eğitim Planı">{MOCK_DETAIL.trainingPlan}</DrawerRow>
      </DrawerSection>

      <DrawerSection title="Evrak Durumu">
        <DrawerRow label="Toplam">
          {candidate.docsDone}/{candidate.docsTotal}
        </DrawerRow>
        <DrawerRow label="MEB Durumu">
          <StatusPill status={candidate.mebStatus} />
        </DrawerRow>
      </DrawerSection>

      <DrawerSection title="Muhasebe">
        <DrawerRow label="Toplam Ücret">{formatBalance(MOCK_DETAIL.totalFee)}</DrawerRow>
        <DrawerRow label="Ödenen" tone="brand">{formatBalance(MOCK_DETAIL.paid)}</DrawerRow>
        <DrawerRow label="Kalan Bakiye" tone="danger">{formatBalance(-remaining)}</DrawerRow>
      </DrawerSection>
    </Drawer>
  );
}
