// Contratos de respuesta de la API (/v1) que consumen web-qr y merchant-panel.
import type { MerchantUserRole, QrCodeStatus, QrCodeType } from './enums.js';

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
