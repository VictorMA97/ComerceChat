// PSP simulado (ARCHITECTURE §16.3): lo usa solo el adaptador FakePaymentProvider de table-payments.
export { FakePspModule } from '../fake-psp.module.js';
export { FakePspService } from '../fake-psp.service.js';
export { FAKE_PSP_SIGNATURE_HEADER, verifyFakePspSignature } from '../fake-psp-signature.js';
