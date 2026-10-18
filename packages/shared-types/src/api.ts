// Contratos de respuesta de la API (/v1) que consumen web-qr y merchant-panel.
import type {
  MerchantUserRole,
  PaymentMethod,
  PaymentStatus,
  SplitMode,
  QrCodeStatus,
  QrCodeType,
} from './enums.js';
import type { SplitRequest, TipRequest } from './split.js';

/** Error de API en formato RFC 9457 (application/problem+json). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
}

export interface MerchantMe {
  merchantUserId: string;
  email: string;
  role: MerchantUserRole;
  merchant: { id: string; brandName: string; status: string };
}

export interface TableQr {
  id: string;
  shortCode: string;
  type: QrCodeType;
  status: QrCodeStatus;
  url: string;
}

export interface TableView {
  id: string;
  label: string;
  capacity: number;
  active: boolean;
  qr: TableQr | null;
}

export interface LocationView {
  id: string;
  name: string;
  address: string;
  category: string;
  tables: TableView[];
}

/** Respuesta pública de GET /v1/qr/{code}: identidad verificada del comercio (FR-QR-04). */
export interface QrResolution {
  shortCode: string;
  type: QrCodeType;
  merchant: { id: string; brandName: string; logoUrl: string | null };
  location: { id: string; name: string; address: string };
  table: { id: string; label: string } | null;
}

export interface BillLine {
  /** Identificador estable de la línea en el TPV (para pagar por platos). */
  lineId: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  totalCents: number;
  /** Unidades ya pagadas por platos con ComerceChat. */
  paidUnits: number;
  /** Unidades que otro comensal está pagando ahora mismo. */
  reservedUnits: number;
}

/** Cuenta de la mesa tal como la ve el comensal (FR-ORD-01). */
export interface TableBill {
  qr: QrResolution;
  bill: {
    lines: BillLine[];
    totalCents: number;
    paidCents: number;
    /** Lo que falta por cobrar (incluye lo que otros comensales están pagando ahora). */
    pendingCents: number;
    /** Importe en sesiones de pago abiertas de otros comensales. */
    reservedCents: number;
    /** Lo que se puede pagar ahora: pendiente − reservado. */
    availableCents: number;
    currency: 'EUR';
  } | null;
  tips: { enabled: boolean; percentages: number[] };
  /** Importe máximo por pago sin cuenta de usuario (FR-PAY-09). */
  guestMaxPaymentCents: number;
}

export interface CreatePaymentSessionRequest {
  /** QR de mesa (con `split`) o token del QR de cobro generado desde la caja (`dynamicToken`). */
  qrCode?: string;
  dynamicToken?: string;
  split?: SplitRequest;
  tip: TipRequest;
  /** Identifica el dispositivo del comensal: un nuevo intento libera sus sesiones anteriores. */
  guestSessionId?: string;
  /** Cupón del usuario identificado que se aplica a este pago (FR-CPN-05). */
  couponId?: string;
}

export interface PaymentSessionResponse {
  paymentId: string;
  /** Token para consultar el estado del pago sin cuenta de usuario. */
  statusToken: string;
  /** Página de pago del PSP (en la PoC, la del PSP simulado). */
  checkoutUrl: string;
  amountCents: number;
  /** Parte cubierta por el cupón: no se cobra. */
  discountCents: number;
  tipCents: number;
  splitMode: SplitMode;
  expiresAt: string;
}

/** Estado y justificante de un pago (FR-PAY-05, FR-PAY-06). No es una factura (REG-05). */
export interface PaymentReceipt {
  paymentId: string;
  status: PaymentStatus;
  failureReason: string | null;
  merchant: { brandName: string };
  location: { name: string; address: string };
  table: { label: string } | null;
  amountCents: number;
  discountCents: number;
  couponTitle: string | null;
  tipCents: number;
  totalCents: number;
  currency: 'EUR';
  method: PaymentMethod | null;
  cardLast4: string | null;
  capturedAt: string | null;
  createdAt: string;
  /** Puntos del pago (FR-LOY-02, FR-USR-02). */
  points: {
    merchantId: string;
    /** Puntos que genera (o generaría) este pago. */
    points: number;
    /** Ya asignados a un usuario. */
    claimed: boolean;
    /** Aún se pueden reclamar (pago capturado, sin usuario y dentro de las 24 h). */
    claimable: boolean;
  } | null;
}

/** Datos que muestra la página del PSP simulado. */
export interface FakeCheckoutSession {
  id: string;
  status: 'OPEN' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  merchantName: string;
  statementDescriptor: string;
  amountCents: number;
  currency: 'EUR';
  returnUrl: string;
}

export type FakeCheckoutOutcome = 'succeed' | 'decline' | 'fail_3ds';

export interface FakePosBillView {
  tableId: string;
  tableLabel: string;
  externalTableId: string | null;
  /** Último QR de cobro generado desde la caja para la mesa (activo o recién cobrado). */
  paymentQr: DynamicQrView | null;
  /** Cuenta abierta o, si no hay, la última cerrada en los últimos 30 minutos. */
  bill: {
    id: string;
    status: 'OPEN' | 'CLOSED';
    closedAt: string | null;
    items: { id: string; name: string; qty: number; unitPriceCents: number }[];
    payments: {
      reference: string;
      amountCents: number;
      tipCents: number;
      discountCents: number;
      createdAt: string;
    }[];
    totalCents: number;
    paidCents: number;
  } | null;
}

export interface FakePosState {
  locationId: string;
  locationName: string;
  health: 'ok' | 'down';
  menu: { id: string; name: string; category: string; priceCents: number }[];
  tables: FakePosBillView[];
}

/** Evento de tiempo real (SSE). Solo avisa de que algo cambió: el cliente vuelve a pedir los datos. */
export interface RealtimeEvent {
  type: 'table.updated';
  locationId: string;
  tableId?: string;
  qrId?: string;
  reason: string;
  at: string;
}

export type FloorTableStatus = 'FREE' | 'OPEN' | 'PAYING' | 'PARTIAL' | 'PAID' | 'POS_DOWN';

/** Vista de sala del camarero (FR-MER-08). */
export interface FloorView {
  locationId: string;
  locationName: string;
  tipsTodayCents: number;
  paymentsTodayCents: number;
  tables: {
    tableId: string;
    label: string;
    status: FloorTableStatus;
    totalCents: number;
    paidCents: number;
    pendingCents: number;
    reservedCents: number;
    tipsTodayCents: number;
    lastPaymentAt: string | null;
  }[];
}

/** QR de cobro de un solo uso que el personal genera desde la caja para una mesa (FR-QR-03). */
export interface DynamicQrView {
  id: string;
  locationId: string;
  tableId: string;
  amountCents: number;
  status: QrCodeStatus;
  url: string;
  expiresAt: string;
  payment: { status: PaymentStatus; tipCents: number; capturedAt: string | null } | null;
}

/** Lo que ve el comensal al escanear el QR de cobro de la caja. */
export interface DynamicQrResolution {
  qrId: string;
  merchant: { id: string; brandName: string; logoUrl: string | null };
  location: { id: string; name: string; address: string };
  table: { id: string; label: string };
  amountCents: number;
  expiresAt: string;
  tips: { enabled: boolean; percentages: number[] };
}

// --- Usuarios, puntos y cupones (P4) ---

export interface OtpStartResponse {
  expiresInSeconds: number;
}

/** Consentimientos separados y no premarcados (REG-07). */
export interface ConsentsInput {
  terms: boolean;
  marketing: boolean;
  /** Comercio con el que el usuario acepta compartir sus datos (para su CRM). */
  shareWithMerchantId?: string;
}

export interface OtpVerifyRequest {
  phone: string;
  code: string;
  name?: string;
  consents?: ConsentsInput;
}

export interface MeView {
  id: string;
  phoneMasked: string;
  name: string | null;
  consents: {
    terms: boolean;
    marketing: boolean;
    sharedWith: { merchantId: string; brandName: string }[];
  };
}

export interface UserSession {
  accessToken: string;
  expiresIn: number;
  user: MeView;
  /** true si la cuenta se acaba de crear. */
  isNew: boolean;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  costPoints: number;
  discountCents: number;
}

export interface LoyaltyView {
  merchant: { id: string; brandName: string };
  balance: number;
  pendingPoints: number;
  pointsPerEuro: number;
  rewards: LoyaltyReward[];
}

export interface CouponView {
  id: string;
  code: string;
  title: string;
  discountCents: number;
  minSpendCents: number;
  validTo: string;
  status: 'ACTIVE' | 'RESERVED' | 'REDEEMED' | 'EXPIRED' | 'REVOKED';
  merchant: { id: string; brandName: string };
}

export interface ClaimPointsRequest {
  paymentId: string;
  statusToken: string;
}

export interface ClaimPointsResponse {
  pointsEarned: number;
  balance: number;
  merchant: { id: string; brandName: string };
  /** Cupones emitidos al reclamar (p. ej. «Vuelve y te invitamos»). */
  newCoupons: CouponView[];
}

export interface PromotionView {
  id: string;
  template: 'COMEBACK';
  name: string;
  discountCents: number;
  minSpendCents: number;
  validDays: number;
  status: 'ACTIVE' | 'ENDED';
  issued: number;
  redeemed: number;
  createdAt: string;
}

export interface CreatePromotionRequest {
  name: string;
  discountCents: number;
  minSpendCents: number;
  validDays: number;
}

export type AnalyticsPeriod = 'today' | 'week' | 'month';

export interface AnalyticsTotals {
  volumeCents: number;
  payments: number;
  avgTicketCents: number;
  tipsCents: number;
  discountsCents: number;
  identifiedCustomers: number;
}

/** Panel de inicio del comercio (FR-ANA-01, versión reducida de la PoC). */
export interface AnalyticsView {
  period: AnalyticsPeriod;
  from: string;
  to: string;
  current: AnalyticsTotals;
  previous: AnalyticsTotals;
  /** Pagos por día del periodo actual. */
  daily: { date: string; volumeCents: number; payments: number }[];
}
