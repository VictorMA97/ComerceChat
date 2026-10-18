// Contratos de respuesta de la API (/v1) que consumen web-qr y merchant-panel.
import type {
  MerchantUserRole,
  PaymentMethod,
  PaymentStatus,
  QrCodeStatus,
  QrCodeType,
} from './enums.js';

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
  merchant: { brandName: string; logoUrl: string | null };
  location: { id: string; name: string; address: string };
  table: { id: string; label: string } | null;
}

export interface BillLine {
  name: string;
  qty: number;
  unitPriceCents: number;
  totalCents: number;
}

/** Cuenta de la mesa tal como la ve el comensal (FR-ORD-01). */
export interface TableBill {
  qr: QrResolution;
  bill: {
    lines: BillLine[];
    totalCents: number;
    paidCents: number;
    pendingCents: number;
    currency: 'EUR';
  } | null;
  tips: { enabled: boolean; percentages: number[] };
  /** Importe máximo por pago sin cuenta de usuario (FR-PAY-09). */
  guestMaxPaymentCents: number;
}

export interface CreatePaymentSessionRequest {
  qrCode: string;
  tipCents: number;
}

export interface PaymentSessionResponse {
  paymentId: string;
  /** Token para consultar el estado del pago sin cuenta de usuario. */
  statusToken: string;
  /** Página de pago del PSP (en la PoC, la del PSP simulado). */
  checkoutUrl: string;
  amountCents: number;
  tipCents: number;
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
  tipCents: number;
  totalCents: number;
  currency: 'EUR';
  method: PaymentMethod | null;
  cardLast4: string | null;
  capturedAt: string | null;
  createdAt: string;
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
  /** Cuenta abierta o, si no hay, la última cerrada en los últimos 30 minutos. */
  bill: {
    id: string;
    status: 'OPEN' | 'CLOSED';
    closedAt: string | null;
    items: { id: string; name: string; qty: number; unitPriceCents: number }[];
    payments: { reference: string; amountCents: number; tipCents: number; createdAt: string }[];
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
