# ComerceChat: análisis crítico de una "superapp" de pagos QR y comercio local para España

**Fecha del análisis:** 17 de octubre de 2026
**Convención usada en todo el documento:**
- **[HECHO]**: dato verificado con fuente (ver el apartado "Fuentes" al final).
- **[HIPÓTESIS]**: supuesto mío, razonable pero sin verificar. Hay que validarlo.
- **[RECOMENDACIÓN]**: mi opinión como asesor.
- **[INCIERTO]**: hay información contradictoria o pendiente (sobre todo en regulación).

> **Aviso:** esto no es asesoramiento jurídico. Antes de firmar con un proveedor de pagos o lanzar funciones de puntos o monedero, hace falta una opinión escrita de un despacho especializado en regulación de pagos (fintech) en España.

---

## 0. Conclusión adelantada (lo que diría un inversor en 60 segundos)

1. **"El WeChat español" no es una tesis invertible en 2026.** WeChat y Alipay triunfaron en China porque allí se dieron condiciones que en España no existen:
   - una base masiva de mensajería ya instalada;
   - una economía basada en efectivo, sin infraestructura de tarjetas que sustituir;
   - comercios sin TPV;
   - un regulador que permitió el crecimiento antes de regular.

   España tiene lo contrario:
   - Pago con tarjeta y NFC casi universal, con Apple Pay y Google Pay.
   - **Bizum, con 30,6 M de usuarios [HECHO], que desde mayo de 2026 ya sirve para pagar en tienda física (NFC y QR) [HECHO].**
   - Comisiones de intercambio limitadas por ley (0,2 % débito y 0,3 % crédito). Por eso el margen de pago es muy fino.
   - Una regulación (PSD2/PSR, AML, GDPR) que convierte cualquier función financiera "nueva" en un coste fijo alto.
2. **El pago QR, por sí solo, no es una ventaja competitiva.** Es una función que ya ofrecen Bizum, Redsys, Stripe, Adyen, SumUp y una docena de startups de pago en mesa (Honei, Qamarero, Cheerfy, Last.app…).
3. **Sí veo una empresa viable, pero distinta:** un **software para hostelería que entra por el pago y pedido en mesa vía QR (web, sin descargar app) y retiene con fidelización y CRM**. Montado sobre un proveedor de pagos regulado de tipo "plataforma" (Stripe Connect, Adyen for Platforms, Monei o Mangopay), empezando en 2–3 barrios de Madrid. La "superapp" de usuario aparece solo si se consigue densidad de comercios. Es un posible resultado, no el punto de partida.
4. **El turismo chino es una funcionalidad y un canal de marketing, no un negocio.** Datos de 2025:
   - ~795.500 turistas chinos en España y un gasto de ~2.200 M€ [HECHO].
   - Solo el ~27 % visita la Comunidad de Madrid [HECHO].
   - Alipay+ ya se acepta en España vía BBVA, Sabadell, ABANCA/Starpay, El Corte Inglés, etc. [HECHO].
5. **Capital razonable para empezar:** 500–800 k€ (pre-seed), hasta llegar a ~150–300 comercios de pago en Madrid con métricas de retención.

El resto del documento desarrolla y justifica todo esto.

---

## 1. Resumen ejecutivo

**Qué es (versión ambiciosa, la tuya):** una plataforma móvil que conecta usuarios y comercios locales. El pago QR es el punto de entrada, y sobre él se añaden descubrimiento, fidelización, cupones, reservas, pedidos y CRM. A largo plazo sería una "superapp" con mini-apps de terceros.

**Qué debería ser (versión invertible, mi propuesta):**

> *Plataforma de "pedir, pagar y volver" para restaurantes y bares de Madrid. El cliente escanea el QR de la mesa y, sin descargar nada, ve la carta, pide, divide la cuenta, paga (tarjeta, Apple Pay, Google Pay, Bizum) y deja propina. Al pagar, se le invita a guardar sus puntos. El comercio obtiene más rotación de mesas, más propinas para el personal y, sobre todo, **datos y un canal directo con sus clientes** (CRM y campañas), algo que hoy le quitan TheFork, Glovo y Google.*

**Propuesta de valor empresarial:**
- **Para el comercio:** más ingresos (rotación, ticket medio, propinas, repetición) y clientes propios. No compramos "una forma más de cobrar".
- **Para el usuario:** pagar sin esperar al camarero, dividir la cuenta sin dramas y recompensas por volver.
- **Para el inversor:** un negocio de software vertical con ingresos por pagos incrustados (*vertical SaaS + embedded payments*, el modelo de Toast, Lightspeed o Sunday). La red de usuarios es una opción de futuro.

**Por qué ahora:**
- Bizum en tienda (2026) y los pagos instantáneos obligatorios en la UE (Reglamento 2024/886) [HECHO] abaratan los pagos de cuenta a cuenta (*account-to-account*, A2A) a medio plazo.
- Los comercios han interiorizado el QR desde la pandemia.
- VeriFactu (obligatorio desde enero/julio de 2027 [HECHO]) obliga a muchos restaurantes a renovar su software de caja. Es una ventana para entrar como socio de su TPV.

---

## 2. Problema

Hay que separar el problema real del problema supuesto.

### 2.1 Comercios (hostelería)

| Problema | ¿Real? | Evidencia / comentario |
|---|---|---|
| Tiempo perdido cobrando (llevar la cuenta, datáfono, dividir) | **Sí, fuerte** en restaurantes con servicio en mesa | Es la propuesta central de Honei, Sunday, Qamarero. Hay que cuantificarlo en entrevistas [HIPÓTESIS: 5–12 min por mesa]. |
| No conocen a sus clientes (el pago con tarjeta es anónimo) | **Sí** | El TPV bancario no da identidad del cliente. TheFork o Glovo se quedan los datos. |
| Dependencia de plataformas con comisiones altas (delivery 15–35 %, reservas por comensal) | **Sí** | Hay una queja estructural del sector. |
| Escasez de personal de sala | **Sí** | Es un problema sectorial muy citado en España desde 2022 [HIPÓTESIS: hay que verificarlo con datos de Hostelería de España]. |
| Fidelización en papel o inexistente | Sí, pero **de baja prioridad** para el dueño | Lo valoran, pero pocas veces pagan por ello de forma aislada. |
| "Necesito otra forma de cobrar" | **No** | Ya tienen TPV bancario barato. Esto es lo que más hay que vigilar. |

### 2.2 Usuarios

| Problema | ¿Real? | Comentario |
|---|---|---|
| Esperar para pagar y dividir la cuenta | **Sí** (sobre todo en grupos) | Es el momento de mayor fricción en un restaurante. |
| Programas de fidelización dispersos (una tarjeta o app por comercio) | Sí, pero tolerado | No es un dolor por el que el usuario vaya a descargar una app. |
| Descubrir comercios | **Casi resuelto** | Google Maps, Instagram, TikTok, TheFork. No es un hueco. |
| Pagar en tienda | **Resuelto** | Tarjeta, NFC, Apple Pay, Google Pay y ahora Bizum. |
| Enviar dinero a amigos | **Resuelto** | Bizum: 1.237 M de operaciones en 2025 [HECHO]. No hay que competir aquí. |

**Conclusión:** el dolor está en **la experiencia en mesa del restaurante y en la relación comercio–cliente**. No está en el pago en general. La superapp responde a problemas que el usuario español no tiene.

---

## 3. Propuesta de valor

### 3.1 ¿Por qué un usuario usaría esto en vez de…?

| Alternativa | Lo que hace mejor que nosotros | Nuestro único ángulo creíble |
|---|---|---|
| Bizum | Ya está instalado (30 M), es de confianza y ahora funciona en tienda | No compitamos: **aceptemos Bizum** dentro de nuestro flujo |
| Apple Pay / Google Pay | Fricción cero y biometría | También se integran en nuestra página de pago |
| PayPal | Protección al comprador y online | Irrelevante en presencial |
| Bancos | Confianza | — |
| Google Maps | Descubrimiento y reseñas | Solo ganamos con ofertas exclusivas de comercios propios |
| Glovo / Uber Eats / Just Eat | Delivery | No competir en delivery en el MVP |
| TheFork / CoverManager | Reservas con descuento y gestión de sala | Reservas solo como funcionalidad para comercios ya clientes |
| Apps propias de cadenas (Starbucks, 100 Montaditos, Telepizza…) | Fidelización profunda | Agregamos la fidelización de independientes, que no pueden tener app propia |

**Verdad incómoda:** el usuario **no descargará una app** para pagar. Por eso el flujo QR debe funcionar **en el navegador** (web o PWA, App Clip en iOS, Instant App en Android). La cuenta y la app deben ser un *upsell* posterior ("guarda tus 140 puntos"), no un requisito.

La propuesta al usuario en una frase: **"Paga en 10 segundos desde la mesa, divide la cuenta sin calculadora y gana recompensas en tus sitios de siempre."**

### 3.2 ¿Por qué un comercio lo usaría?

Solo si hay **ROI medible en < 60 días**:
1. **Más rotación de mesas** (cobro más rápido) → más cubiertos en horas punta.
2. **Más propinas** (las propinas digitales sugeridas suelen subir la propina media [HIPÓTESIS: dato de la industria, hay que medirlo en piloto]). **Esto convierte a los camareros en tus vendedores internos.**
3. **Base de datos propia de clientes** + campañas → repetición.
4. **Menos dependencia** de TheFork y Glovo.
5. **Coste predecible** y sin cambiar su TPV ni su software de caja.

Si el comercio tiene que cambiar su software de caja, formar al personal durante una semana o pagar más que con su TPV bancario sin ver más ingresos, **no lo usará**.

---

## 4. Competencia

### 4.1 Tabla comparativa

Las comisiones son orientativas; hay que verificarlas con cada proveedor porque son negociables y cambian.

| Actor | Tipo | Pago presencial | QR | Fidelización / CRM | Descubrimiento | Coste comercio (aprox.) | Amenaza para nosotros |
|---|---|---|---|---|---|---|---|
| **Bizum** | Esquema A2A bancario (ES) | **Sí desde mayo 2026** (NFC, QR, enlace) | Sí | No | No | Lo fija cada banco [INCIERTO] | **Muy alta** si quisiéramos ser "medio de pago". **Aliado** si lo aceptamos como método |
| **PayPal** | Monedero / PSP | Marginal en ES | Sí (PayPal QR) | No | No | ~2,9 % + fijo (online) | Baja en presencial |
| **Apple Pay** | Monedero sobre tarjetas | Sí (NFC) | No | Pases de fidelización en Wallet | No | El coste de la tarjeta | Media: es el estándar de UX |
| **Google Pay** | Igual | Sí | No | Pases en Wallet | Maps es Google | Coste tarjeta | Media-alta (Google Maps + Wallet) |
| **Revolut** | Neobanco con licencia | Revolut Pay, Revolut Business con TPV | Sí | Programa RevPoints | Revolut "Lifestyle" | Competitivo | **Alta a largo plazo**: es lo más cercano a una superapp europea |
| **Stripe** | PSP / adquirente | Terminal + Tap to Pay | Payment Links / QR | Básico | No | ~1,5 % + 0,25 € tarjetas EEE estándar [verificar] | **Proveedor**, no competidor |
| **Adyen** | Adquirente global | Sí | Sí | Datos | No | Interchange++ (barato a escala) | Proveedor (mínimos altos) |
| **SumUp** | Adquirente para pymes | Sí | Sí | Algo de fidelización | No | Tarifa plana ~1–2 % [verificar] | Media en comercios pequeños |
| **Redsys / TPV bancario** (CaixaBank–Comercia, BBVA, Santander Getnet…) | Procesador / adquirentes | **Dominante** | Sí | No | No | **Muy bajo** para pymes negociadas [HIPÓTESIS: 0,3–0,8 %] | **El listón de precio que debemos justificar** |
| **Alipay+ / Alipay** | Monedero chino + red transfronteriza | Sí, vía adquirentes ES | Sí | Dentro de Alipay | **Sí, para turistas** | Vía adquirente | Baja: es un método más a aceptar |
| **WeChat Pay** | Monedero chino | Sí (vía partners) | Sí | Mini-programas | Sí, para turistas | Vía adquirente | Baja: es un método más a aceptar |
| **Wero (EPI)** | Monedero A2A europeo | POS previsto 2026–2027; interconexión con Bizum vía EuroPA en fases [HECHO/INCIERTO] | Sí | No | No | — | Media a medio plazo |
| **Honei** (ES) | Pago y pedido en mesa | Sí (QR) | Sí | Básico | No | Comisión por transacción | **Competidor directo** (+300 marcas según la empresa) |
| **Qamarero** (ES) | TPV + pedido en mesa QR | Sí | Sí | Sí | No | SaaS | **Competidor directo** |
| **Last.app, Revo, Ágora, ICG…** (ES) | Software de caja (TPV) para hostelería | Integran pagos | Algunos | Algunos | No | SaaS | **Competidores o socios.** Hay que integrarse con ellos |
| **Sunday** (FR) | Pago en mesa QR | Sí | Sí | Reseñas / CRM | No | Comisión | Competidor; presencia en ES por verificar |
| **Cheerfy** (ES) | Pedido / pago + CRM | Sí | Sí | **Sí** | No | SaaS | Competidor directo en CRM |
| **TheFork / CoverManager** | Reservas | No | No | Yums / CRM de sala | **Sí** | Por comensal o SaaS | Indirecto: dueños del cliente que reserva |
| **Glovo / Uber Eats / Just Eat** | Delivery | No | No | Promos | **Sí** | 15–35 % | Indirecto |
| **Google Maps** | Descubrimiento | No | No | No | **Dominante** | Gratis o anuncios | Hace muy difícil competir en descubrimiento |

### 4.2 Lectura crítica

- **El mercado de pago QR en mesa en España ya está ocupado** por al menos 4–5 actores locales. Ninguno se ha convertido en una "superapp", y eso es una señal en sí misma.
- **Tu diferenciación no puede ser el pago.** Puede ser:
  - (a) **densidad en un territorio** (un barrio entero en la red);
  - (b) **fidelización de coalición entre comercios independientes** (puntos que valen en el bar de al lado);
  - (c) **mejor CRM y campañas** (WhatsApp);
  - (d) **más integraciones con software de caja**.
- **El riesgo de plataforma es real:** si Bizum, Revolut o Google Wallet añaden fidelización ligera de comercios, el valor para el usuario se evapora.

---

## 5. Modelo de negocio

| Fuente de ingresos | Cómo | Rango orientativo [HIPÓTESIS] | ¿MVP? | Comentario crítico |
|---|---|---|---|---|
| **Comisión por transacción** (sobre el coste del PSP) | Cobras al comercio X % y el PSP te cuesta Y % | Margen neto 0,2–0,5 % del volumen procesado | **Sí** | Margen fino. **No pagará la empresa por sí solo** |
| **Suscripción SaaS** | Plan mensual por local | 39–129 €/mes | **Sí (con 2–3 meses gratis)** | Es el ingreso predecible. Hay que defenderlo con ROI |
| **Fidelización / CRM** | Incluido en el plan Pro | +20–40 €/mes | **Sí, básico** | Es lo que te diferencia de "otro TPV" |
| **Campañas de marketing** (WhatsApp, email, push) | Por mensaje o paquete | 0,05–0,15 €/mensaje WhatsApp + margen | Fase 2 | El coste de WhatsApp Business lo fija Meta |
| **Cupones** | Gratis para crear; cobras por canjeado o en el plan | — | Básico en el MVP, sin cobrar aparte | Cobrar por cupón genera fricción |
| **Comercio destacado / publicidad** | Pago por posición en mapa y lista | CPM o tarifa plana | **No** | Solo tiene sentido con >20–50 k usuarios activos al mes en una ciudad |
| **Reservas** | Incluido o por comensal | 0,5–1,5 €/comensal (tipo TheFork) | No | Competir con CoverManager o TheFork es caro |
| **Pedidos para llevar / *click & collect*** | Comisión 3–8 % | — | Fase 2 | Es un buen añadido, pero no en el MVP |
| **Delivery** | — | — | **Nunca en los 3 primeros años** | Mercado con unidad económica brutal |
| **Servicios premium al usuario** (suscripción) | Tipo "club" con ventajas | 3–6 €/mes | No | Requiere red densa |
| **Datos agregados / *insights* de barrio** | Para marcas o distribuidores de bebidas | — | No | Cuidado con GDPR. Solo datos anonimizados y agregados |
| **Patrocinios de marcas de bebida** (Mahou, Estrella Galicia, Coca-Cola…) | Pagan por campañas y cupones en tu red | Alto potencial | Fase 2–3 | **Canal infravalorado en hostelería española**: las marcas ya subvencionan bares |
| **API / mini-apps** | Para terceros | — | Fase 4+ | Es la parte "WeChat" del plan. Sin red, nadie desarrolla para ti |
| **Monedero / saldo / cashback** | — | — | **No** (requiere licencia, ver §7) | — |

**Modelo recomendado para el MVP:** `Plan SaaS (49–79 €/mes/local) + margen sobre pagos (~0,3–0,5 %) + propinas sin comisión (como gancho)`.
Alternativa a testar: *"sin cuota, 1 % extra por transacción"* para reducir la barrera de entrada. Hay que hacer un test A/B de precio con los primeros 30 comercios.

---

## 6. Modelo de pagos

### 6.1 Flujo técnico recomendado (MVP)

```
[Usuario] escanea QR estático de mesa
   │  (URL https://pay.tudominio.es/t/AB12CD con firma)
   ▼
[Web/PWA ComerceChat] ── consulta la cuenta de la mesa ──► [Software de caja del restaurante (API)]
   │  muestra carta / cuenta / dividir / propina
   ▼
[Página de pago del PSP (Payment Element / Drop-in)]  ← tarjeta, Apple Pay, Google Pay, Bizum, Alipay+…
   │  SCA/3DS cuando aplique
   ▼
[PSP (Stripe Connect / Adyen for Platforms / Monei / Mangopay)]
   │  autoriza → captura → divide el pago:
   │     • importe neto → cuenta del COMERCIO en el PSP (comercio dado de alta y verificado por el PSP)
   │     • comisión de plataforma (application fee) → cuenta de ComerceChat
   ▼
[Liquidación al IBAN del comercio] (T+1/T+2 según PSP)
   │
[Webhook del PSP] → ComerceChat marca la cuenta como pagada → avisa al software de caja → suma puntos al usuario
```

**Clave regulatoria:** el dinero **nunca pasa por una cuenta de ComerceChat**. El comercio es cliente del PSP (que hace la verificación KYB y la prevención de blanqueo). Tú eres un proveedor de software que se queda una comisión por plataforma. Así evitas necesitar licencia de entidad de pago (ver §7).

### 6.2 Análisis de opciones

| Opción | Cómo funciona | Coste comercio | UX | Fraude / devoluciones forzosas (*chargebacks*) | Veredicto MVP |
|---|---|---|---|---|---|
| **PSP de plataforma** (Stripe Connect, Adyen for Platforms, Mangopay, Lemonway, **Monei** —español, acepta Bizum—, Paycomet) | Comercio dado de alta bajo tu plataforma | Más alto que el TPV bancario (tarifa plana del PSP + tu margen) | Muy buena | El PSP gestiona; el riesgo de pérdidas se negocia | **✅ Recomendado** |
| **Bizum** (vía PSP como Monei o Paycomet) | El usuario confirma en la app del banco | Variable por banco o PSP [INCIERTO] | Buena (todos lo tienen) | Pagos A2A: no hay *chargeback* como en tarjeta | **✅ Como método dentro del PSP** |
| **Adquirencia propia** (contrato directo con banco o Redsys) | Te conviertes en "facilitador de pagos" o necesitas licencia | Más barato a escala | — | Asumes tú el riesgo | ❌ Fase 3+ |
| **Open Banking / iniciación de pagos** (Tink, TrueLayer, Yapily, Token…) | El usuario autoriza la transferencia desde su banco | Bajo (por operación) | **Peor que Bizum en España** (redirecciones, selección de banco) | Riesgo bajo, pero las devoluciones son manuales | ❌ No en el MVP; revisar con PSD3/PSR y pagos instantáneos |
| **Tarjetas vía QR** (lo que hace el flujo de arriba) | El QR abre una web y paga con tarjeta o monedero | Tarifa de pago online (con tarjeta no presente), más cara que la presencial | Buena con Apple/Google Pay | **Riesgo de *chargeback* online**; 3DS desplaza la responsabilidad al banco emisor | ✅ |
| **NFC** (Tap to Pay en el móvil del camarero) | El camarero cobra con su móvil | Tarifa presencial | Muy buena | Bajo | Fase 2 (Stripe y Adyen lo ofrecen) |
| **NFC propio en el móvil del usuario** (abierto en iOS en el EEE desde 2024 por la ley europea de mercados digitales, DMA) | Wallet propia | — | — | — | ❌ Requiere ser emisor o un socio emisor. Es la jugada de Bizum Pay, no la tuya |
| **Wallet / saldo propio** | El usuario recarga saldo | — | — | — | ❌ **Requiere licencia de dinero electrónico** |
| **Cuenta bancaria propia** | — | — | — | — | ❌ Requiere licencia bancaria o de dinero electrónico |

### 6.3 Dos verdades económicas sobre pagos

1. **El pago QR con tarjeta es una transacción remota (con tarjeta no presente).** Eso implica:
   - Comisión de PSP más alta que la del datáfono.
   - Aplica la autenticación reforzada (SCA) salvo exenciones (bajo importe < 30 €, análisis de riesgo).
   - Más riesgo de *chargeback* por "no reconozco el cargo".

   Por eso la UX debe mostrar claramente el nombre del comercio para que aparezca bien en el extracto (*descriptor*).
2. **Los tickets pequeños destruyen el margen.** Con una tarifa tipo 1,5 % + 0,25 €, un café de 2,50 € cuesta 0,29 € de comisión (**~11,5 %**). **Por eso cafeterías y bares de café NO son buen primer segmento para pago QR con tarjeta.** Encajan restaurantes con ticket de 25–80 €, donde la comisión es del 1,8–2,5 %. Esa cifra sigue siendo superior a su TPV bancario, así que tiene que compensarse con rotación, propinas y repetición.

**Recomendación MVP:**
- **Un único PSP de plataforma** que soporte tarjetas, Apple Pay, Google Pay y Bizum. Evalúa Stripe Connect, Adyen for Platforms y Monei en paralelo; Monei tiene ventaja local con Bizum y quizá precio.
- Alipay+ y WeChat Pay como método adicional **solo si el PSP lo da "llave en mano"**.
- Nada de saldo propio ni de transferencias entre usuarios (P2P).
- **Elimina "envío/solicitud de dinero" del alcance**: Bizum ya lo hace gratis, con 30 M de usuarios, y requeriría licencia.

---

## 7. Regulación (España y UE, a octubre de 2026)

### 7.1 Estado normativo

| Norma | Estado a oct-2026 | Implicación para ti |
|---|---|---|
| **PSD2** (Directiva 2015/2366) + **Real Decreto-ley 19/2018** (transposición española) | **Vigente** [HECHO] | Define qué es "servicio de pago". Si recibes o transmites fondos de terceros, necesitas autorización como entidad de pago o actuar como agente de una |
| **PSD3 + PSR** (Reglamento de Servicios de Pago) | Acuerdo político de nov-2025; aprobados en la comisión ECON del Parlamento en mayo de 2026; **publicación en el Diario Oficial prevista para finales de 2026** [INCIERTO]. Aplicación general **~21 meses tras entrada en vigor (≈2028)** | Más responsabilidad por fraude por suplantación, obligaciones de cooperación para plataformas, transparencia de comisiones. **La exclusión de "agente comercial" se estrecha todavía más.** Las entidades de dinero electrónico se integran en el régimen de entidades de pago |
| **Reglamento de Pagos Instantáneos** (UE 2024/886) | **Vigente.** Recepción obligatoria desde ene-2025, envío y verificación del beneficiario desde oct-2025 en la zona euro [HECHO] | Hace viable el pago A2A barato a medio plazo (Wero, Bizum, iniciación de pagos) |
| **Reglamento de Comisiones de Intercambio** (UE 2015/751) | Vigente | Tope 0,2 % débito y 0,3 % crédito consumo. Explica por qué el margen de pago es fino |
| **Dinero electrónico** (Directiva 2009/110 + Ley 21/2011) | Vigente; se absorbe en PSD3 | Saldo prepago, monedero o puntos canjeables por dinero ⇒ licencia |
| **Prevención del blanqueo** (Ley 10/2010 + RD 304/2014; Reglamento UE AMLR 2024/1624 **aplicable desde 10-jul-2027**; nueva autoridad europea AMLA operativa) | Vigente / en transición | No eres sujeto obligado si no prestas servicios de pago. Tu PSP sí, y te exigirá colaborar (datos de comercios, monitorización) |
| **GDPR + LOPDGDD** (Ley Orgánica 3/2018); autoridad: AEPD | Vigente | Geolocalización, perfiles de consumo y marketing ⇒ evaluación de impacto (DPIA) probablemente obligatoria. Base legal clara para compartir datos con comercios |
| **LSSI-CE** (Ley 34/2002), art. 21 | Vigente | Comunicaciones comerciales electrónicas solo con consentimiento o relación previa |
| **Defensa del consumidor** (TRLGDCU, RDL 1/2007) + Directiva Ómnibus | Vigente | Precios de promociones (precio anterior más bajo de 30 días si anuncias rebajas), condiciones claras de puntos y cupones, caducidades |
| **Autenticación reforzada (SCA)** (RTS UE 2018/389) | Vigente | La aplica tu PSP (3DS). Exenciones: bajo importe, análisis de riesgo, comercio de confianza |
| **Acceso a datos financieros (FiDA)** | Propuesta en negociación / alcance incierto [INCIERTO] | No relevante para el MVP |
| **Euro digital** | Parlamento votó abrir negociación interinstitucional el 9-jul-2026. Pilotos "a partir de mediados de 2027" si se adopta [HECHO/INCIERTO] | **Riesgo/oportunidad a 2028+**: la aceptación obligatoria del euro digital podría abaratar el pago presencial |
| **DORA** (Reglamento UE 2022/2554) | Aplica desde ene-2025 a entidades financieras | No te aplica directamente, pero tu PSP puede exigirte cláusulas de resiliencia y seguridad TIC |
| **Accesibilidad** (Directiva UE 2019/882 transpuesta por Ley 11/2023; aplica desde jun-2025) | Vigente | Comercio electrónico y servicios bancarios al consumidor deben ser accesibles. Diseña con WCAG 2.1 AA desde el día 1 |
| **VeriFactu** (RD 1007/2023; aplazado por RDL 15/2025) | Obligatorio **1-ene-2027 sociedades / 1-jul-2027 resto** [HECHO] | **Si tu panel emite tickets o facturas, eres sistema informático de facturación y debes cumplirlo.** Recomendación: **no emitir tickets**; delega en el software de caja del restaurante |
| **Exclusión de "red limitada"** (art. 4 y 6 RDL 19/2018; Directrices EBA 2022) | Vigente | Si haces puntos o tarjetas regalo multi-comercio, puede encajar aquí. **Obligación de notificar al Banco de España si superas 1 M€ en 12 meses** [HECHO] |

### 7.2 A) Lo que puedes hacer como empresa tecnológica (sin licencia)

- Software: carta digital, pedidos, gestión de mesas, reservas, CRM, analítica, campañas.
- Generar QR, estáticos y dinámicos, que **lleven a la página de pago de un PSP**.
- Cobrar al comercio una cuota SaaS y una **comisión de plataforma descontada por el PSP**.
- **Puntos de fidelización que:**
  - (a) no se compran con dinero;
  - (b) no se canjean por dinero;
  - (c) se canjean solo por descuentos o productos del comercio emisor o de una red acotada.

  Mientras sean "promocionales y gratuitos" normalmente **no son dinero electrónico** [HIPÓTESIS jurídica: hay que confirmarlo con un despacho]. Ojo con las coaliciones multi-comercio: revisa la exclusión de red limitada.
- Cupones emitidos y financiados por el comercio.
- Mostrar historial de pagos (datos recibidos del PSP).

### 7.3 B) Lo que requiere un proveedor regulado

- Aceptar pagos (tarjeta, Bizum, Alipay+, A2A).
- Verificación de comercios (KYB) y prevención del blanqueo del comercio.
- Liquidación de fondos al comercio, reparto de pagos entre partes, devoluciones y *chargebacks*.
- Propinas: entran como parte del pago al comercio. El reparto al personal es un asunto laboral y fiscal del comercio, no tuyo.
- Iniciación de pagos por Open Banking (vía proveedor autorizado).
- Pago presencial NFC con Tap to Pay (vía PSP).
- Tarjetas regalo prepago (vía emisor de dinero electrónico).

### 7.4 C) Lo que requeriría licencia o autorización propia (Banco de España)

| Actividad | Licencia | Coste y plazo orientativo [HIPÓTESIS] |
|---|---|---|
| Recibir fondos de usuarios y redistribuirlos a comercios por tu cuenta | Entidad de pago (o ser **agente** registrado de una) | 12–18 meses, capital mínimo 20–125 k€ según servicio, más compliance permanente (≥150–300 k€/año) |
| Monedero con saldo, recargas o cashback en saldo | **Entidad de dinero electrónico** (capital mínimo 350 k€) | 12–24 meses |
| Transferencias entre usuarios (P2P) | Entidad de pago o de dinero electrónico | Igual |
| Puntos que se compran o se canjean por dinero | Probablemente dinero electrónico | — |
| Crédito / "paga después" (BNPL) | Normativa de crédito al consumo (nueva Directiva UE 2023/2225 en transposición) | Fase 4+ |
| Cambio de divisa para turistas | Entidad de pago / establecimiento de cambio | No |
| Cripto | MiCA (Reglamento UE 2023/1114) | No |

**Nota sobre la "exclusión de agente comercial":** muchos marketplaces intentaron cobrar "en nombre del comercio" amparándose en el art. 3(b) PSD2. La EBA y los supervisores la interpretan de forma restrictiva, y la PSR la acota aún más. **No construyas el negocio sobre esa exclusión.**

---

## 8. Producto: MVP

### 8.1 Principio rector

**Primero un modo "un solo jugador" para el comercio** (el comercio obtiene valor aunque no haya ningún otro comercio en la red). Después, la red.

### 8.2 Qué SÍ incluye el MVP (v1, ~4–6 meses)

**Experiencia del comensal (web/PWA, sin descarga obligatoria):**
- Escaneo de QR de mesa → identidad del comercio verificada (nombre, foto, dominio).
- Ver la cuenta en tiempo real (vía integración con el software de caja) y la carta.
- Dividir la cuenta: por partes iguales, por artículos o por importe libre.
- Propina sugerida (0 / 5 / 10 % / otra).
- Pago: tarjeta, Apple Pay, Google Pay, Bizum (si el PSP lo soporta).
- Recibo digital (justificante de pago; **la factura simplificada la emite el software de caja**).
- Tras pagar: "Guarda tus X puntos" → alta con teléfono (código por SMS o WhatsApp) o Apple/Google.
- Valoración rápida (1–5) → privada para el comercio; si es 5, se invita a dejar reseña en Google.

**App de usuario (nativa, mínima; puede llegar en el mes 4–6):**
- Cartera de puntos por comercio.
- Cupones activos.
- Historial de pagos hechos con ComerceChat.
- Lista o mapa sencillo de **comercios de la red** (solo los adheridos).
- Notificaciones push.

**Panel del comercio (web):**
- Alta del comercio con verificación KYB del PSP (*onboarding* alojado por el PSP).
- Gestión de mesas y generación e impresión de QR.
- Configuración de propinas y de fidelización (puntos por euro o sellos).
- Creación de cupones y promociones sencillas (p. ej. "-10 % en tu próxima visita de martes a jueves").
- Panel: ventas vía ComerceChat, propinas, ticket medio, clientes identificados, repetición.
- Lista de clientes (CRM básico) con consentimiento de marketing.
- Exportación CSV.
- Roles: dueño / encargado / camarero.

**Integraciones:**
- **1–2 softwares de caja de hostelería** populares en el barrio objetivo. **Esta es la tarea técnica más crítica.** Sin integración, el camarero tiene que teclear el importe y el valor cae a la mitad.
- Un solo PSP.

### 8.3 Qué NO incluye el MVP

- ❌ Monedero, saldo, recargas, P2P, cashback en dinero.
- ❌ Delivery.
- ❌ Reservas (salvo enlace a la herramienta que ya usen).
- ❌ Mapa de "todos los comercios de Madrid" (solo los de la red).
- ❌ Comercio destacado / publicidad.
- ❌ Mini-apps y API pública.
- ❌ Puntos de coalición entre comercios (piloto en fase 2 tras revisión legal).
- ❌ Emisión de tickets o facturas (VeriFactu).
- ❌ Multi-idioma completo (solo ES/EN; ZH en fase 2 si se valida el turismo).
- ❌ Chat comercio–usuario.
- ❌ Inteligencia artificial "porque sí".

### 8.4 Subsistemas

- **QR:** estático por mesa (URL corta + identificador firmado) y dinámico por importe para mostrador (con caducidad de 5–10 min).
- **Pagos:** abstracción de un único PSP, pero con una interfaz interna `PaymentProvider` para poder añadir un segundo PSP sin reescribir.
- **Fidelización:** registro contable de puntos de solo-inserción (no se borran ni se editan movimientos), reglas por comercio y caducidad configurable.
- **Cupones:** plantilla + instancias de un solo uso con código único, condiciones (día, hora, importe mínimo) y canje atómico.
- **Mapa:** PostGIS + Mapbox o MapLibre (más barato que Google Maps a escala).
- **Notificaciones:** push (FCM/APNs), email transaccional y **WhatsApp Business** (el canal que de verdad leen los españoles) con plantillas aprobadas.
- **Analítica:** eventos de producto (PostHog alojado en la UE) y métricas de negocio desde la base de datos.

---

## 9. Recorridos de usuario (*user journeys*)

### A) El usuario se registra

1. Paga en un restaurante como invitado, sin cuenta.
2. En la pantalla de éxito: "Has ganado 45 puntos en Casa Pepe. Guárdalos".
3. Introduce su móvil → recibe un código por SMS o WhatsApp → validado.
4. Nombre (opcional), fecha de nacimiento (opcional, para un regalo de cumpleaños), y consentimientos **separados y no premarcados**:
   - (a) términos;
   - (b) marketing de ComerceChat;
   - (c) compartir sus datos con el comercio para que le envíe ofertas.
5. Se le ofrece instalar la app o añadir una tarjeta de fidelización a Apple/Google Wallet (menos fricción que la app).
6. Los puntos de la visita quedan asociados.

*Métrica clave:* % de pagadores que se registran (objetivo inicial 15–25 % [HIPÓTESIS]).

### B) El usuario encuentra un comercio

1. Abre la app → pestaña "Cerca".
2. Ve los comercios de la red ordenados por distancia, con sus puntos acumulados y las ofertas activas.
3. Filtra por "tengo cupón" o "abierto ahora".
4. Pulsa el comercio → ficha (fotos, carta, horario, oferta, botón "Cómo llegar" que abre Google o Apple Maps).

*Realismo:* esto solo aporta valor con más de 50 comercios en un radio de ~1 km. Antes de eso, la pestaña "Cerca" debe mostrar **"Tus sitios"** (donde ya has estado).

### C) El usuario paga mediante QR

1. Escanea el QR de la mesa con la cámara nativa.
2. Se abre `pay.comercechat.es/t/…`. Ve el **logo, nombre y dirección del comercio** y la mesa: "Mesa 7".
3. Ve la cuenta actual, traída del software de caja.
4. Elige: pagar todo / dividir / pagar mis platos.
5. Elige la propina.
6. Paga con Apple Pay (1 toque + Face ID) o tarjeta (3DS si aplica) o Bizum (redirección a su app del banco).
7. Confirmación. La caja del restaurante marca la mesa como pagada (o parcialmente pagada). El camarero lo ve en su dispositivo.
8. Recibo por email o descarga + invitación a guardar puntos.

### D) El usuario realiza una compra (pedido en mesa)

1. Escanea el QR → "Ver carta y pedir".
2. Añade productos y modificadores (sin gluten, punto de la carne).
3. Envía el pedido → llega a cocina o barra vía software de caja.
4. Opción: pagar ahora (barra o terraza, sin camarero) o al final.
5. Estados del pedido: recibido → en preparación → servido.

### E) El usuario recibe puntos

1. Llega la confirmación de pago del PSP (señal `payment.succeeded`).
2. El motor de fidelización calcula los puntos: `floor(importe_sin_propina × regla_del_comercio)`.
3. Se crea un movimiento `EARN` en el registro de puntos con estado `PENDING`.
4. Pasa a `AVAILABLE` tras X horas o al cerrar el día (para poder anularlo si hay devolución o *chargeback*).
5. Notificación push: "+45 puntos en Casa Pepe. Te faltan 55 para un postre gratis".

### F) El usuario utiliza un cupón

1. En el paso de pago, el sistema detecta cupones aplicables del usuario (o este escanea o introduce un código).
2. Validación en servidor: vigente, no canjeado, condiciones cumplidas, comercio correcto.
3. **Reserva atómica** del cupón (estado `RESERVED` con bloqueo) → se aplica el descuento al importe.
4. Si el pago es correcto → `REDEEMED`. Si falla o caduca la sesión → vuelve a `ACTIVE`.
5. El descuento se registra para la analítica del comercio (coste de la promoción frente a ingresos generados).

### G) El comerciante crea una promoción

1. Panel → Promociones → "Nueva".
2. Plantilla: "Vuelve y te invitamos" / "Martes flojos -15 %" / "Cumpleaños" / "Recupera clientes dormidos (sin visita en 60 días)".
3. Define: público (todos / nuevos / habituales / dormidos), condiciones, vigencia, límite de canjes y presupuesto.
4. Canal: dentro de la app y push (gratis) o WhatsApp (de pago por mensaje).
5. Vista previa + estimación de alcance (nº de clientes con consentimiento).
6. Publica → los cupones se generan individualmente.
7. A las 48 h: informe de envíos, aperturas, canjes e ingresos atribuidos.

### H) El comerciante cobra

1. **Mesa:** el cliente paga solo. El camarero ve "Mesa 7 pagada · Propina 4,20 €".
2. **Mostrador:** el empleado introduce el importe en la tablet o móvil → se genera un QR dinámico (caduca en 5 min) → el cliente lo escanea y paga. Alternativa en fase 2: Tap to Pay NFC en el móvil del empleado.
3. Liquidación: el PSP abona el neto al IBAN del comercio (T+1/T+2).
4. Panel → Pagos: listado con comisión desglosada, propinas y conciliación por día.

### I) El comerciante analiza sus ventas

Panel de inicio:
- Volumen vía ComerceChat (hoy, semana, mes).
- Ticket medio.
- Propinas.
- Tiempo medio de pago.
- % de mesas pagadas por QR.
- Clientes identificados: nuevos frente a recurrentes.
- **Tasa de repetición a 30 y 60 días.**
- Promociones: canjes, coste e ingresos atribuidos.
- Comparativa con la semana anterior.
- Alertas: "Tienes 112 clientes que no vuelven desde hace 45 días. ¿Lanzar campaña?"

---

## 10. Arquitectura técnica

### 10.1 Visión general

```
                         ┌──────────────── Cloudflare (DNS, WAF, CDN, anti-bots) ────────────────┐
                         │                                                                       │
 Comensal (navegador) ──►│  Web de pago QR (Next.js, renderizado en servidor)                     │
 App usuario (Expo RN) ─►│  API Gateway / ALB                                                    │
 Panel comercio (Next) ─►│                                                                       │
                         └───────────────────────────────┬───────────────────────────────────────┘
                                                         ▼
                ┌──────────────── Backend NestJS (monolito modular, TypeScript) ───────────────┐
                │ módulos: auth · merchants · venues/tables · qr · orders · payments ·          │
                │          loyalty-ledger · coupons · campaigns · notifications · analytics ·   │
                │          pos-integrations · admin/backoffice · risk                           │
                └──────┬──────────────┬─────────────────┬────────────────┬──────────────────────┘
                       ▼              ▼                 ▼                ▼
               PostgreSQL 16     Redis (cache,      Cola de trabajos   Almacenamiento S3
               + PostGIS         límites, estado    (SQS o BullMQ)     (imágenes, export.)
               (RDS Multi-AZ)    de mesa, locks)          │
                       │                                  ▼
                       │                   Workers: webhooks PSP, puntos, campañas,
                       │                   sincronización con cajas, notificaciones
                       ▼
           Réplica de lectura → ETL → almacén de datos (BigQuery / ClickHouse, fase 2)

 Externos: PSP (Stripe/Adyen/Monei) · APIs de software de caja · FCM/APNs · WhatsApp Business API
           · Email (Postmark/SES) · SMS/OTP · Mapbox/MapLibre · PostHog EU · Sentry
```

### 10.2 Elecciones y por qué

| Capa | Elección | Por qué | Alternativa |
|---|---|---|---|
| Web de pago QR | **Next.js (React) + TypeScript** | El 90 % de los pagos ocurrirán aquí. Debe cargar en < 1,5 s en 4G, sin instalar nada. El renderizado en servidor y la edge network ayudan | SvelteKit |
| App usuario | **React Native con Expo** | Comparte lenguaje, tipos y lógica con web y backend. Un equipo pequeño mantiene todo en TypeScript. Expo facilita actualizaciones sin pasar por tienda | Flutter (excelente UI, pero obliga a un segundo lenguaje, Dart, con un equipo de 3–4 devs) |
| Panel comercio | **Next.js + biblioteca de componentes** (shadcn/ui) | Rápido de construir. Es la misma tecnología que la web QR | — |
| Backend | **NestJS (Node/TypeScript), monolito modular** | Estructura clara (módulos, inyección de dependencias), buen ecosistema, un solo lenguaje. **Microservicios: no** hasta tener >15 ingenieros | Go o Kotlin si el equipo lo domina |
| BD principal | **PostgreSQL 16 + PostGIS** | Transaccional (puntos, cupones y pagos necesitan garantías ACID), consultas geográficas para el mapa, JSONB para configuración flexible | — |
| Cache / estado | **Redis** | Estado en tiempo real de la mesa, límites de peticiones, bloqueos distribuidos, sesiones de pago | — |
| Colas | **AWS SQS** (o BullMQ sobre Redis al inicio) | Los webhooks del PSP y las campañas deben procesarse de forma asíncrona, con reintentos idempotentes | — |
| Tiempo real | WebSockets (Socket.IO) o Server-Sent Events | Estado de cuenta compartido cuando 4 personas pagan la misma mesa | — |
| Cloud | **AWS región eu-south-2 (España)** o eu-west-3 (París) | Residencia de datos en la UE (ayuda con GDPR y con las auditorías de los PSP). Servicios gestionados maduros (RDS, SQS, KMS) | GCP europe-southwest1 (Madrid) es igual de válida |
| Infraestructura como código | Terraform | Reproducible y auditable | Pulumi |
| Contenedores | ECS Fargate (no Kubernetes al inicio) | Menos operación | EKS en fase 3 |
| Autenticación usuarios | OTP por SMS o WhatsApp + **passkeys** + Sign in with Apple/Google. Gestionado (AWS Cognito, Auth0 o Clerk) o propio con buenas librerías | Sin contraseñas = menos robo de cuentas | — |
| Autenticación comercios | Email + contraseña + **doble factor obligatorio** para el dueño. Control de acceso por roles | El panel controla reembolsos y datos de clientes | — |
| Pagos | Integración de servidor con el PSP + componentes de pago alojados por el PSP | **Ámbito PCI DSS mínimo (cuestionario SAQ A)**: los datos de tarjeta nunca tocan tus servidores | — |
| Notificaciones | Expo Push (FCM/APNs), Postmark/SES, WhatsApp Business (vía proveedor oficial: Twilio, 360dialog, Infobip) | — | — |
| Analítica producto | **PostHog (nube UE)** | Embudos, grabación de sesiones (desactivada en pantallas de pago) y feature flags | Amplitude |
| Analítica negocio | Metabase sobre réplica → BigQuery/ClickHouse en fase 2 | Barato | Looker |
| Monitorización | **Sentry** (errores), **OpenTelemetry + Grafana Cloud o Datadog**, alertas en PagerDuty u Opsgenie | — | — |
| Secretos | AWS Secrets Manager + KMS | — | — |
| CI/CD | GitHub Actions, revisión de dependencias, análisis estático (Semgrep), escaneo de secretos | — | — |

### 10.3 APIs

- **API interna REST** (OpenAPI generado desde NestJS), versionada `/v1`.
- **Webhooks entrantes:** PSP y software de caja. Hay que verificar la firma y usar **claves de idempotencia** para no procesar dos veces el mismo evento.
- **Webhooks salientes** (fase 3): para terceros.
- **API pública / mini-apps** (fase 4): OAuth2, ámbitos de permiso y entorno de pruebas (*sandbox*).

### 10.4 Seguridad (resumen; detalle en §12)

- Cifrado TLS 1.2+ en tránsito y cifrado en reposo con KMS (RDS, S3).
- Los datos personales sensibles (teléfono, email) se guardan en columnas cifradas o como identificadores sustitutos (*tokens*) donde se pueda.
- Mínimo privilegio en los permisos de la nube; acceso a producción solo vía bastión y con registro de auditoría.
- Revisión de seguridad de la app móvil contra el estándar OWASP MASVS (L1 en el MVP).
- **Pentest externo antes del lanzamiento** y después cada año.
- Registro de auditoría inmutable para reembolsos, cambios de IBAN (los gestiona el PSP), ajustes de puntos y cambios de rol.

---

## 11. Modelo de datos

### 11.1 Entidades principales

```
User(id, phone_e164 UNIQUE, email, name, birthdate?, locale, status, created_at, risk_score)
UserConsent(id, user_id, type[TERMS|MKT_PLATFORM|SHARE_WITH_MERCHANT], merchant_id?, granted, version, ts, source)
Device(id, user_id, push_token, platform, fingerprint_hash, last_seen)

Merchant(id, legal_name, tax_id (CIF/NIF), brand_name, status[ONBOARDING|ACTIVE|SUSPENDED],
         psp_account_id, psp_kyb_status, plan_id, created_at)
MerchantUser(id, merchant_id, email, role[OWNER|MANAGER|STAFF], mfa_enabled)
MerchantLocation(id, merchant_id, name, address, geo POINT (PostGIS), timezone, opening_hours JSONB,
                 category, pos_integration_id?)
Table(id, location_id, label, capacity, active)

QRCode(id, type[STATIC_TABLE|STATIC_COUNTER|DYNAMIC_AMOUNT], location_id, table_id?,
       short_code UNIQUE, signature, amount_cents?, currency, expires_at?, status, created_by, created_at)

Product(id, location_id, category_id, name, description, price_cents, tax_rate, allergens[],
        modifiers JSONB, available, pos_external_id)

Order(id, location_id, table_id?, user_id?, source[QR|POS|COUNTER], status[OPEN|SENT|SERVED|PAID|CANCELLED],
      subtotal_cents, discount_cents, total_cents, pos_external_id, created_at)
OrderItem(id, order_id, product_id, qty, unit_price_cents, modifiers JSONB)

Payment(id, order_id?, location_id, user_id?, psp, psp_payment_id UNIQUE, method[CARD|APPLE_PAY|GOOGLE_PAY|BIZUM|ALIPAY_PLUS],
        amount_cents, tip_cents, platform_fee_cents, psp_fee_cents?, currency,
        status[CREATED|AUTHORIZED|CAPTURED|FAILED|REFUNDED|PARTIALLY_REFUNDED|DISPUTED],
        idempotency_key UNIQUE, created_at)
PaymentSplit(id, payment_id, payer_session_id, amount_cents)     -- dividir la cuenta
Transaction(id, payment_id, type[CHARGE|REFUND|CHARGEBACK|CHARGEBACK_REVERSAL|PAYOUT|FEE],
            amount_cents, psp_reference, occurred_at)            -- espejo contable de eventos del PSP; inmutable

LoyaltyProgram(id, merchant_id | coalition_id, type[POINTS|STAMPS], earn_rule JSONB, expiry_days, status)
LoyaltyAccount(id, user_id, program_id, balance_cached, tier, UNIQUE(user_id, program_id))
PointsLedgerEntry(id, account_id, type[EARN|REDEEM|EXPIRE|REVERSE|ADJUST], points (+/-),
                  payment_id?, coupon_redemption_id?, status[PENDING|AVAILABLE|VOID], reason, created_by, created_at)
                  -- solo inserción; el saldo = suma; balance_cached se recalcula

Promotion(id, merchant_id, name, audience JSONB, rules JSONB, channel[], budget_cents?, max_redemptions,
          starts_at, ends_at, status)
Coupon(id, promotion_id, user_id?, code UNIQUE, status[ACTIVE|RESERVED|REDEEMED|EXPIRED|REVOKED],
       reserved_until?, valid_from, valid_to)
CouponRedemption(id, coupon_id UNIQUE, payment_id, discount_cents, redeemed_at)

Reservation(id, location_id, user_id, party_size, starts_at, status, source)   -- fase 2
Review(id, location_id, user_id, payment_id UNIQUE, rating 1-5, comment, visibility[PRIVATE|PUBLIC], created_at)
Notification(id, user_id | merchant_user_id, channel[PUSH|EMAIL|WHATSAPP|SMS|IN_APP], template, payload JSONB,
             campaign_id?, status, sent_at, opened_at)
Campaign(id, merchant_id, promotion_id?, channel, audience_snapshot_count, cost_cents, status, scheduled_at)

AuditLog(id, actor_type, actor_id, action, entity, entity_id, before JSONB, after JSONB, ip, ts)
RiskEvent(id, entity_type, entity_id, rule, score, action[ALLOW|REVIEW|BLOCK], ts)
```

### 11.2 Relaciones clave

- `Merchant 1─N MerchantLocation 1─N Table 1─N QRCode`
- `MerchantLocation 1─N Product`, `1─N Order`, `1─N Payment`
- `Order 1─N Payment` (pago dividido entre varias personas) y `Payment 1─N Transaction` (cobro, devolución, *chargeback*…)
- `User 1─N LoyaltyAccount N─1 LoyaltyProgram N─1 Merchant` (o coalición en fase 2)
- `LoyaltyAccount 1─N PointsLedgerEntry` (registro inmutable; el saldo se deriva)
- `Promotion 1─N Coupon 1─0..1 CouponRedemption 1─1 Payment`
- `User N─N Merchant` vía `UserConsent(SHARE_WITH_MERCHANT)`: **el comercio solo ve a los clientes que han consentido.**
- `Payment 1─0..1 Review` (solo se reseña quien ha pagado: reseñas verificadas)

**Decisión de diseño importante:** `Payment` refleja el estado del PSP, y `Transaction` es la contabilidad de movimientos. El PSP es la **fuente de verdad del dinero**; tu base de datos es la fuente de verdad de **puntos, cupones y pedidos**. Hay que conciliar a diario con los informes del PSP.

---

## 12. Seguridad y fraude

| Amenaza | Vector concreto | Controles |
|---|---|---|
| **QR falsificados** | Pegatina encima del QR real que lleva a una web de *phishing* (fraude muy documentado en parquímetros) | 1) QR que **solo apuntan a tu dominio**; la UI muestra el nombre y la foto del comercio y la mesa, y educa: "verifica que ves *pay.comercechat.es*". 2) Identificador corto + **firma en el servidor** (el identificador no es adivinable y la firma se valida). 3) Placas físicas **antimanipulación** (metacrilato, etiquetas que se rompen al despegarlas) y foto de referencia en el panel. 4) Revisión periódica por el personal. 5) En los QR dinámicos: caducidad, importe firmado y nonce de un solo uso. 6) Detección de dominios parecidos (*typosquatting*) y retirada (*takedown*) |
| **Pagos fraudulentos** (tarjetas robadas) | Pruebas de tarjetas robadas, compras con tarjeta robada | Herramientas antifraude del PSP (Stripe Radar / Adyen RevenueProtect), 3DS por riesgo, límites de peticiones por dispositivo, IP y tarjeta, CAPTCHA invisible, importe máximo por pago QR sin cuenta (p. ej. 300 €) |
| **Cuentas falsas** | Granjas de cuentas para abusar de bonos de bienvenida o referidos | OTP por teléfono, bloqueo de números virtuales (VoIP) y desechables, huella del dispositivo (*device fingerprint*), **recompensas solo tras pago real**, límites por dispositivo, revisión manual a partir de un umbral |
| **Chargebacks** | "No reconozco el cargo" o fraude amistoso | *Descriptor* claro ("COMERCECHAT*CASA PEPE"), recibo inmediato, 3DS (desplaza la responsabilidad al banco emisor), pruebas automáticas (registro de la mesa, pedido, IP) enviadas al PSP. **Contrato: la responsabilidad del chargeback es del comercio** (como en cualquier TPV), con fondo de reserva si hay riesgo |
| **Robo de cuentas** | SIM swapping, phishing | Passkeys, OTP más señales de riesgo, alerta al cambiar de dispositivo, **sin saldo monetario que robar** (los puntos son de bajo valor), retención de 24–48 h para canjes grandes tras un cambio de teléfono |
| **Manipulación de puntos** | Empleado o comercio que se autoasigna puntos; usuario que paga y pide devolución | Puntos solo vía webhook del PSP (nunca desde el cliente), estado `PENDING` hasta cerrar el día, anulación automática si hay reembolso o *chargeback*, ajustes manuales solo por rol OWNER con motivo y registro de auditoría, alertas por anomalías (mismo usuario y mismo empleado repetidamente) |
| **Cupones duplicados** | Reutilizar un código, carreras entre peticiones simultáneas, compartir capturas | Códigos únicos por usuario, **restricción UNIQUE en `CouponRedemption.coupon_id`**, reserva atómica (`SELECT … FOR UPDATE` o Redis lock + transacción), vinculación al `user_id`, caducidad, límites globales por promoción |
| **Blanqueo de capitales** | Comercio fachada que procesa ventas ficticias; abuso de propinas para mover dinero | **El PSP hace la verificación KYB y la prevención del blanqueo** (es sujeto obligado). Tú añades: monitorización de patrones (propina > 30 %, mismo pagador recurrente con importes redondos, volumen incoherente con la categoría), canal para enviar señales al PSP, suspensión contractual. Sin P2P ni saldo, el riesgo de blanqueo en tu plataforma baja muchísimo, **otra razón para no hacer monedero** |
| **Fraude de comercios** | Comercio que cobra y cierra | La liquidación y las reservas de fondos las gestiona el PSP. Tú: validación de existencia física (visita de alta), revisión de reseñas |
| **Abuso de API / scraping** | Enumerar mesas o comercios | WAF, límites de peticiones e identificadores no secuenciales |
| **Amenaza interna** | Empleado de ComerceChat | Acceso just-in-time a producción, registro de auditoría y separación de funciones |

---

## 13. Salida al mercado: Madrid

### 13.1 Hipótesis a desafiar

- *"Lanzar en Madrid"* es demasiado amplio. **Hay que lanzar en 2 barrios.** El efecto red local se mide en manzanas, no en ciudades.
- *"Restaurantes, cafeterías, bares, tiendas, peluquerías, gimnasios, hoteles"* son **7 productos distintos**. Elige **uno**.

### 13.2 Primer comercio objetivo (perfil ideal de cliente)

- **Restaurante independiente o grupo pequeño (1–5 locales)**, servicio en mesa, **ticket medio 25–60 €**, 60–200 cubiertos al día, terraza (pico de rotación).
- Usa un **software de caja en la nube con API** (de los que integremos).
- Dueño de 28–50 años que ya usa Instagram y ha sufrido las comisiones de TheFork o Glovo.
- Barrios candidatos [HIPÓTESIS, a validar con un recuento de locales y visitas]:
  - **Malasaña / Conde Duque**, **Chamberí (Ponzano, Trafalgar)**, **Lavapiés / La Latina** (alta densidad, público joven, turistas);
  - alternativa: **Salamanca** (ticket alto, menor rotación).
- **Evitar al inicio:** cafeterías (ticket pequeño), cadenas (ciclos de venta largos), hoteles (otra integración, otro producto), peluquerías y gimnasios (otro caso de uso: suscripción o cita).

### 13.3 Primer usuario objetivo

- Persona de 22–40 años que vive o trabaja en el barrio, come o cena fuera 2+ veces por semana, en grupos (dividir cuenta = dolor real), usa Apple Pay o Bizum.
- **No se le adquiere con marketing: se le adquiere en la mesa.** Cada comercio es un canal de adquisición de usuarios a coste casi cero.

### 13.4 Objetivos de densidad

| Hito | Comercios activos | Zona |
|---|---|---|
| Mes 0–3 (piloto) | 10–15 socios de diseño | 1 barrio |
| Mes 6 | 50 | 2 barrios |
| Mes 12 | 150–250 | 4–6 barrios |
| Mes 18–24 | 500–1.000 | Madrid centro + segunda ciudad |

### 13.5 Cómo conseguir los primeros 100 comercios

1. **20 entrevistas de descubrimiento antes de escribir código** (dueños y encargados). Pregunta qué pagan hoy, cuánto tardan en cobrar, cuánto dan de propina, qué software de caja usan.
2. **Socios de diseño (10–15):** 6 meses gratis + instalación gratis + línea directa de WhatsApp con los fundadores, a cambio de feedback semanal y datos.
3. **Venta puerta a puerta** de 16:00 a 19:30 (entre servicios). Un fundador o comercial puede visitar 15–20 locales al día. Conversión a demo: 20–30 % [HIPÓTESIS]; de demo a alta: 20–40 % [HIPÓTESIS].
4. **Alianza con 1–2 softwares de caja** (comisión por referido o reparto de ingresos). Su base instalada es tu canal.
5. **Distribuidores de bebidas y cerveceras.** Ya visitan cada bar semanalmente y subvencionan material. Proponles una campaña de cupones patrocinada.
6. **Asociaciones:** Hostelería Madrid, asociaciones de comerciantes de barrio.
7. **Gestorías y asesorías de hostelería** (con VeriFactu en el horizonte buscan soluciones de software).
8. **Prueba social local:** en cuanto tengas 5 locales en una calle, el sexto te llama.
9. **Los camareros como promotores:** muestra el dato de propinas. Si las propinas digitales suben, el personal empuja el QR.
10. **Garantía:** "Si en 60 días no ves +X % de propinas o más rotación, te devolvemos la cuota".

### 13.6 Cómo conseguir los primeros 1.000 usuarios

Con 15 restaurantes × ~1.500 comensales al mes × 20 % que paga por QR ≈ 4.500 pagadores al mes. Con un 20–25 % de registro ⇒ **~1.000 usuarios registrados en el primer mes del piloto** [HIPÓTESIS sobre las tasas].

Palancas:
- **Pagar sin registrarse siempre posible.** El registro se pide **después**, con un incentivo concreto ("guarda tus 45 puntos").
- **Primera recompensa rápida**, financiada por el comercio: "2ª visita = postre o café gratis".
- Tarjeta de fidelización en Apple/Google Wallet sin necesidad de app.
- **Cartelería en mesa** con un mensaje de beneficio, no de marca: "Paga sin esperar · divide la cuenta en 10 s".
- Contenido local (Instagram, TikTok): "los 10 sitios de Malasaña donde no esperas para pagar".

### 13.7 Incentivos y promociones

- **Financiados por el comercio** (cupón de vuelta) → coste cero para ti y ROI demostrable.
- **Cofinanciados con marcas** (bebidas) → pagan la promoción.
- **Evita el cashback financiado por ti.** Quema caja y atrae a cazadores de ofertas que no se quedan. Es la historia de muchas superapps fallidas.

### 13.8 Referidos

- **Usuario → usuario:** "Invita a tus amigos a dividir la cuenta". El propio acto de dividir es viral: cuando uno paga su parte, los demás de la mesa ven el flujo. **Este es tu bucle de crecimiento natural.**
- **Comercio → comercio:** 2 meses gratis por cada comercio referido que se active.
- **Usuario → comercio:** "¿Quieres que tu bar favorito esté en ComerceChat?" → formulario → lead para el equipo de ventas.

### 13.9 Efecto red

- **Fase 1 (sin efecto red):** valor "un solo jugador" para cada comercio (cobro, propinas, CRM).
- **Fase 2 (efecto local):** **coalición de barrio**: puntos que valen en los comercios adheridos de la zona (tras revisión legal de red limitada). Esto crea un motivo para que el usuario prefiera la red y para que el comercio quiera estar.
- **Fase 3:** descubrimiento ("Cerca") y promociones cruzadas, que solo funcionan con densidad.
- **Sé honesto con los inversores:** el efecto red de la fidelización de coalición es **débil y local** comparado con el de un marketplace. El foso defensivo real será: integraciones con software de caja, datos de CRM y coste de cambio del comercio.

---

## 14. Turismo

### 14.1 Datos [HECHO, fuente Turespaña/INE]

- 2025: **~795.500 turistas chinos** en España (+22,6 %), **~2.200 M€** de gasto (+18 %). Gasto medio de **2.775 €/persona** y **459 €/persona/día**, con una estancia media de 6 noches.
- Destinos: **Cataluña 56 %**, **Comunidad de Madrid 27 %** (dato de visitas).
- Representan el **0,8 % de turistas** y el **1,6 % del gasto** de los ~96,8 M de turistas internacionales.

**Estimación para Madrid [HIPÓTESIS]:** 27 % × 795.500 ≈ 215.000 turistas chinos al año. Si un 50 % de su gasto ocurre en Madrid, son ~300 M€. Pero una gran parte va a lujo, hoteles y compras en grandes almacenes (El Corte Inglés, outlets), que **ya aceptan Alipay+**. La parte capturable en restauración independiente es probablemente de **decenas de millones de euros al año**. Es interesante, pero insuficiente para sostener una empresa por sí sola.

### 14.2 Cómo pagan los turistas

| Origen | Método predominante | ¿Hay hueco? |
|---|---|---|
| China | Alipay, WeChat Pay, UnionPay; cada vez más Visa/Mastercard vinculadas a Alipay o WeChat | **Parcial**: Alipay+ ya está en grandes comercios; en restaurantes independientes, menos |
| Corea, Japón, Sudeste Asiático | Tarjetas + monederos de la red Alipay+ (Kakao Pay, Naver Pay, GCash, TrueMoney, Touch 'n Go…) | Parcial: Alipay+ los agrega |
| EE. UU., Reino Unido, UE, Latinoamérica | Tarjetas, Apple Pay, Google Pay, Revolut | **No hay hueco de pago**. Sí lo hay de idioma y descubrimiento |

### 14.3 Cómo puede servir tu plataforma de puente

1. **Pago:** añadir **Alipay+ y WeChat Pay como métodos** en tu página de pago QR, si tu PSP los soporta (Adyen y Stripe ofrecen Alipay y WeChat Pay como métodos de pago, hay que verificar disponibilidad para presencial y en España) o vía un integrador local tipo Starpay o PayXper. **No necesitas acuerdo directo con Ant Group.**
2. **Idioma:** carta traducida automáticamente (ZH, EN, FR, KO…) con fotos. Es un valor real y barato para el restaurante.
3. **Descubrimiento:** las campañas no ocurren en tu app (ningún turista chino la descargará). Ocurren en **Xiaohongshu (RedNote), Dianping o la sección de descubrimiento de Alipay**. Tu valor es **enrolar comercios** y dar contenido.
4. **Fidelización:** irrelevante para el turista (una visita).

### 14.4 Veredicto turismo

- ✅ **Sí como funcionalidad:** carta multiidioma + aceptación de Alipay+/WeChat Pay vía PSP + etiqueta "Alipay accepted". Es un argumento de venta para restaurantes del centro (Sol, Gran Vía, Barrio de las Letras, Salamanca).
- ❌ **No como nicho de lanzamiento.** Las razones:
  - Mercado pequeño y estacional.
  - Grandes comercios ya resueltos.
  - Usuario que no se queda.
  - Distribución controlada por Ant y Tencent.
  - Riesgo geopolítico o de caída del turismo chino.
  - Competencia directa de integradores (Starpay, PayXper) y de los bancos.

---

## 15. Economía unitaria

### 15.1 Hipótesis base (todas son HIPÓTESIS que hay que validar en el piloto)

| Variable | Valor | Justificación |
|---|---|---|
| Facturación mensual de un restaurante objetivo | 45.000 € | Restaurante medio en barrio céntrico; hay que verificarlo en entrevistas |
| % de esa facturación cobrada vía ComerceChat | 25 % (año 1) → 40 % (madurez) | Muchos clientes seguirán pagando con el camarero |
| Volumen procesado por local al mes | ~11.250 € (año 1) | 45.000 × 25 % |
| Ticket medio por pago | 35 € | Con la cuenta dividida, el ticket por pago baja |
| Precio cobrado al comercio por pagos | 1,9 % + 0,10 € | Competitivo frente a pago en mesa; caro frente a TPV bancario |
| Coste PSP | ~1,4 % + 0,15 € (negociado con volumen) | Tarjetas EEE estándar + Apple/Google Pay + algo de premium/internacional; hay que verificarlo con ofertas reales |
| **Margen neto de pagos** | ≈ 0,5 % − 0,05 €/operación ≈ **0,36 % del volumen** | 11.250 € × 0,36 % ≈ **40 €/mes** |
| Cuota SaaS media (tras descuentos) | 59 €/mes | Mezcla de planes |
| Ingreso por campañas y otros | 6 €/mes (año 1) → 20 €/mes (año 3) | WhatsApp y patrocinios |
| **Ingreso medio por comercio (ARPA)** | **~105 €/mes (≈1.260 €/año)** | |
| Coste directo por comercio (soporte, infra, SMS/OTP, hardware QR amortizado) | ~25 €/mes | |
| **Margen bruto por comercio** | **~80 €/mes (≈76 %)** | |
| Abandono mensual de comercios (churn) | 3 % (≈31 % anual) | Hostelería: alta tasa de cierres + competencia |
| CAC comercio | 900 € | Comercial con coste total ~50 k€/año que cierra ~8 altas netas al mes (~96/año) → 520 € + marketing, material, instalación e incentivos → ~900 € |
| CAC usuario | 0,5–2 € | Adquisición en mesa (incentivo financiado por el comercio). Con marketing pagado: 8–20 € |

### 15.2 Métricas derivadas por comercio

- **LTV comercio** = 80 € / 3 % ≈ **2.670 €**
- **LTV/CAC** ≈ 2.670 / 900 ≈ **3,0x** (aceptable; inversores de etapa seed buscan ≥3x)
- **Recuperación del CAC (*payback*)** ≈ 900 / 80 ≈ **11 meses** (aceptable para pymes; ideal < 12)
- **Sensibilidad:** con churn al 5 % mensual → LTV 1.600 € → LTV/CAC 1,8x (**negocio no viable**). **Por eso el churn es la métrica nº 1.**

### 15.3 Escenarios por escala

| Escenario | Volumen procesado anual | Ingresos anuales | Coste PSP (aprox.) | Margen bruto | Comentario |
|---|---|---|---|---|---|
| **1.000 comercios** | 1.000 × 11.250 × 12 ≈ **135 M€** | 1.000 × 1.260 ≈ **1,26 M€** | ~2,4 M€ (tráfico de paso, no cuenta como ingreso neto) | ~0,96 M€ | **No cubre un equipo de 15–20 personas** (~1,5–1,8 M€) + otros gastos |
| **10.000 comercios** | ≈ **1.350 M€** | ≈ **12,6 M€** (+ mejora de margen PSP con volumen) | — | ~9,6–10,5 M€ | Rentable con equipo de 70–90 personas. Requiere **varias ciudades** (Madrid sola probablemente no tiene 10.000 restaurantes objetivo [HIPÓTESIS]) |

| Escenario usuarios | Supuestos | Ingresos atribuibles al usuario |
|---|---|---|
| **100.000 usuarios registrados** | 35 % activos al mes; 2,2 pagos al mes por activo; 35 € por pago | Volumen ≈ 100k × 0,35 × 2,2 × 35 × 12 ≈ **32 M€/año**, que ya está contado en el volumen de los comercios. Ingreso publicitario incremental: **casi 0** (sin densidad) |
| **1.000.000 usuarios** | 30 % activos al mes | Volumen ≈ 277 M€/año; publicidad y comercio destacado: 1–3 €/usuario activo/año ⇒ **0,3–0,9 M€**; patrocinios de marcas: 0,5–2 M€ |

**Lectura:** el ARPU directo del usuario es bajo. **El negocio se paga con comercios, no con usuarios.** Los usuarios son el foso defensivo y la palanca de venta ("te traemos clientes"), no la fuente de ingresos. Esto es lo opuesto a la tesis "superapp".

### 15.4 Punto de equilibrio

- Estructura de costes con ~22 personas en Madrid + marketing + infraestructura + legal ≈ **2,6–3,0 M€/año** [HIPÓTESIS].
- Margen bruto por comercio ≈ 960 €/año ⇒ **equilibrio con ≈ 2.800–3.200 comercios activos**, **sin contar el CAC de nuevas altas**. Contando el crecimiento: **~3.500–4.500**.
- Con un 10–15 % de penetración en restaurantes objetivo de Madrid, esto implica **expansión a Barcelona, Valencia, Málaga o Sevilla antes del equilibrio**.

---

## 16. Coste de desarrollo (España, 2026)

**Hipótesis de tarifas:**
- Sénior autónomo: 45–70 €/h.
- Agencia española: 50–90 €/h.
- Salarios brutos en Madrid: sénior backend o móvil 55–75 k€; CTO 80–110 k€ + equity.
- Coste empresa ≈ bruto × 1,32 (Seguridad Social).

### A) MVP muy básico (validar en 10–15 locales) · 3–4 meses

Incluye: web QR + pago Stripe Connect o Monei + panel mínimo + importe tecleado o 1 integración sencilla + puntos simples. Sin app nativa.

| Partida | Coste |
|---|---|
| Diseño UX/UI (40–60 h + sistema visual) | 3–6 k€ |
| Web de pago QR | 10–18 k€ |
| Backend | 15–25 k€ |
| Panel comercio | 8–15 k€ |
| Seguridad (revisión básica, buenas prácticas) | 2–4 k€ |
| Integración pagos | 4–8 k€ |
| Infraestructura (6 meses) | 1–2 k€ |
| Legal (condiciones, privacidad, contrato comercio) | 4–8 k€ |
| Compliance (consulta regulatoria PSD2 / fidelización) | 3–8 k€ |
| Mantenimiento (3 meses) | 3–6 k€ |
| **Total** | **≈ 55–100 k€** (o ~0 € en efectivo si los fundadores técnicos lo construyen, pero con coste de oportunidad) |

### B) MVP profesional (lanzar en 2 barrios, 50–150 locales) · 6–8 meses

| Partida | Coste |
|---|---|
| Diseño (investigación, prototipos, sistema de diseño, accesibilidad) | 20–35 k€ |
| App usuario (React Native) + web QR | 60–100 k€ |
| Backend (puntos, cupones, campañas, webhooks, conciliación) | 70–120 k€ |
| Panel comercio | 35–60 k€ |
| Seguridad (pentest externo + MASVS + modelado de amenazas) | 10–25 k€ |
| Integración pagos (PSP + Bizum + pruebas de chargebacks y devoluciones) | 15–30 k€ |
| Integraciones software de caja (2) | 25–50 k€ |
| Infraestructura (año 1) | 8–20 k€ |
| Legal (sociedad, pactos de socios, contratos, condiciones, privacidad, DPIA) | 15–30 k€ |
| Compliance (opinión formal de despacho sobre PSD2, red limitada y puntos; política de prevención de fraude) | 10–25 k€ |
| Mantenimiento y soporte (6 meses) | 20–40 k€ |
| **Total** | **≈ 290–535 k€** |

### C) Plataforma escalable (multi-ciudad, 1.000–10.000 comercios) · coste anual de equipo

| Partida | Coste anual |
|---|---|
| Producto y diseño (2–3) | 180–280 k€ |
| Ingeniería (10–16: móvil, backend, frontend, datos, plataforma, QA) | 1,0–1,7 M€ |
| Seguridad (responsable de seguridad + pentests + bug bounty + preparación ISO 27001/SOC 2) | 150–250 k€ |
| Pagos (ingeniería + operaciones de pagos y conciliación) | 120–200 k€ |
| Infraestructura | 60–200 k€ |
| Legal y compliance (interno + externos; **más si se pide licencia propia: +300–600 k€/año**) | 120–300 k€ |
| Mantenimiento: incluido en ingeniería (~30–40 % del tiempo) | — |
| **Total producto + tecnología** | **≈ 1,8–3,1 M€/año** |

---

## 17. Equipo

| Rol | Fase 0–6 m | ¿Externalizable? | Comentario |
|---|---|---|---|
| **CEO / fundador comercial** | Imprescindible | No | Hace las 100 primeras ventas en persona. Si nadie del equipo fundador vende a hosteleros, **no empieces** |
| **CTO cofundador** | Imprescindible | **No** | Una fintech con el núcleo técnico externalizado es casi ininvertible y muy lenta iterando |
| Backend sénior | 1 | Parcialmente (autónomo de confianza) | Experiencia con pagos o webhooks |
| Móvil / fullstack (React/RN) | 1 | Parcialmente | La web QR es crítica; la app nativa puede esperar |
| Frontend | Lo cubre el fullstack | Sí | — |
| Product | El CEO o el CTO al inicio | — | Contratar PM al llegar a 5+ ingenieros |
| UX/UI | Autónomo 20–40 h/mes | **Sí** | — |
| Compliance | Despacho externo | **Sí** | Interno solo si se pide licencia propia |
| Legal | Despacho externo | **Sí** | — |
| Marketing | Un fundador + autónomo de contenido | Sí | Al inicio el marketing es venta de campo |
| Ventas | 1–2 comerciales de campo desde el mes 4–6 | No (comisión variable) | Perfil: ex-comercial de distribuidor de bebidas o de software de caja |
| Customer success / onboarding | 1 desde 30+ comercios | No | Soporte por WhatsApp en horario de hostelería (incluye noches y fines de semana) |

**Equipo mínimo de lanzamiento:** 2–3 fundadores (negocio + tecnología [+ producto/diseño]) + 1–2 desarrolladores + diseño y legal externos. **≈ 4–5 personas a tiempo completo.**

---

## 18. Hoja de ruta

| Etapa | Objetivos | Entregables | KPIs de salida |
|---|---|---|---|
| **0–3 meses** · Validación | Validar el dolor y la disposición a pagar; elegir PSP y software de caja; constituir sociedad; opinión legal | 30 entrevistas, prototipo navegable, MVP muy básico en 3–5 locales, contrato PSP | ≥10 cartas de intención; ≥3 locales usando el producto; ≥15 % de mesas pagadas por QR en esos locales |
| **3–6 meses** · Piloto | MVP profesional v1; 2 barrios | Integración con 1 software de caja, puntos, cupones, panel | 30–50 comercios activos; volumen ≥ 250 k€/mes; churn < 3 %/mes; ≥ 20 % de pagadores registrados; NPS comercio > 40 |
| **6–12 meses** · Ajuste producto-mercado | Demostrar ROI y repetición; vender de forma repetible | App de usuario, campañas WhatsApp, 2ª integración, Tap to Pay, carta multiidioma + Alipay+ | 150–250 comercios; 2–3 M€/mes de volumen; ARR ≥ 250–350 k€; payback ≤ 12 meses; repetición de usuarios a 60 días ≥ 30 % |
| **12–24 meses** · Escalar Madrid + 2ª ciudad | Densidad; coalición de barrio; patrocinios de marcas | Coalición de puntos (tras revisión legal), descubrimiento "Cerca", motor de campañas, Barcelona o Valencia | 800–1.200 comercios; ARR 1–1,5 M€; NRR comercios ≥ 100 %; 150–300 k usuarios registrados |
| **24–36 meses** · Plataforma | Multi-ciudad ES (+ Portugal?); API; decidir sobre licencia propia | API pública, reservas y para llevar, publicidad local, posible agente o licencia de entidad de pago | 2.500–4.000 comercios; ARR 3–5 M€; margen de contribución positivo; camino a EBITDA ≥ 0 |

---

## 19. KPIs

| KPI | Definición precisa | Objetivo orientativo año 1 |
|---|---|---|
| **Comercios activos** | Locales con ≥ 50 pagos vía plataforma en los últimos 30 días | 150–250 |
| **Usuarios activos (MAU)** | Usuarios registrados con ≥ 1 pago o canje en 30 días | 15–30 k |
| **Volumen bruto (GMV)** | Valor total de pedidos y pagos gestionados por la plataforma | — |
| **Volumen procesado (TPV)** | Valor cobrado vía el PSP a través de la plataforma (incluye propinas) | 2–3 M€/mes al cierre del año 1 |
| **Transacciones** | Nº de pagos correctos | — |
| **Penetración en el local** | % de mesas o tickets del local pagados por QR | ≥ 25 % |
| **Retención de comercios** | % de comercios activos en el mes M que siguen activos en M+3 | ≥ 90 % |
| **Retención de usuarios** | % de usuarios con pago en el mes 0 que vuelven a pagar en M1 / M3 | 35 % / 25 % |
| **Frecuencia** | Pagos al mes por usuario activo | ≥ 2 |
| **Repetición en el comercio** | % de clientes identificados que vuelven al mismo local en 60 días | ≥ 30 % (es el KPI que vende) |
| **CAC comercio / usuario** | Coste total de ventas y marketing / altas | ≤ 900 € / ≤ 2 € |
| **LTV** | Margen bruto mensual / churn | ≥ 3 × CAC |
| **Churn de comercios** | Bajas en el mes / activos al inicio | < 3 % mensual |
| **Conversión** | Escaneo → pago; pago → registro; demo → alta | 70 % / 20 % / 30 % |
| **Ingresos y ARR** | SaaS + margen de pagos + otros | ARR ≥ 300 k€ |
| **Take rate neto** | Ingresos de pagos netos de coste PSP / volumen procesado | ≥ 0,35 % |
| **Margen bruto** | (Ingresos − PSP − infra − soporte directo) / ingresos | ≥ 65 % |
| **Tasa de chargebacks y fraude** | Disputas / transacciones | < 0,3 % (los esquemas de tarjetas penalizan a partir de ~0,9–1 %) |

---

## 20. Finanzas a 3 años (escenarios)

**Hipótesis comunes:**
- ARPA según §15, creciendo del 85 €/mes en el año 1 (descuentos) a 115 €/mes en el año 3.
- Margen bruto del 70–76 %.
- Costes de equipo en Madrid; la plantilla crece según la escala.
- Todas las cifras en M€ y redondeadas. **Son ilustrativas**, no una previsión.

### Pesimista

Ventas lentas, churn del 4,5 %, solo una integración con software de caja.

| | Año 1 | Año 2 | Año 3 |
|---|---|---|---|
| Comercios fin de año | 60 | 300 | 800 |
| Ingresos | 0,03 | 0,20 | 0,65 |
| Costes operativos totales | 0,70 | 1,50 | 2,20 |
| **EBITDA** | **−0,67** | **−1,30** | **−1,55** |
| Necesidad de financiación acumulada | 0,7 | 2,0 | 3,5 |

→ **Resultado probable: no levanta Serie A.** Hay que pivotar (p. ej. a software de fidelización puro o venta a un software de caja) o cerrar.

### Base

| | Año 1 | Año 2 | Año 3 |
|---|---|---|---|
| Comercios fin de año | 150 | 900 | 3.000 |
| Ingresos | 0,08 | 0,60 | 2,40 |
| Costes operativos totales | 0,90 | 2,20 | 4,00 |
| **EBITDA** | **−0,82** | **−1,60** | **−1,60** |
| Necesidad de financiación acumulada | 0,9 | 2,5 | 4,1 |

→ Pre-seed de 0,6–0,8 M€ + seed de 2,5–3,5 M€ cubren hasta el año 3. **La Serie A se levanta con ~2,5–3 M€ de ARR** en el mes 30–36.

### Optimista

| | Año 1 | Año 2 | Año 3 |
|---|---|---|---|
| Comercios fin de año | 300 | 2.000 | 6.500 |
| Ingresos | 0,15 | 1,40 | 5,80 |
| Costes operativos totales | 1,10 | 3,20 | 6,80 |
| **EBITDA** | **−0,95** | **−1,80** | **−1,00** |
| Necesidad de financiación acumulada | 1,1 | 2,9 | 3,9 |

→ Serie A de 10–15 M€ en el mes 20–24 para expansión nacional y Portugal.

**Nota crítica:** incluso en el escenario optimista **no hay EBITDA positivo antes del año 4**. Cualquier plan que muestre rentabilidad en el año 2 en este sector no es creíble.

---

## 21. Financiación

| Ronda | Importe razonable | Valoración orientativa pre-money [HIPÓTESIS de mercado ES 2026] | Hitos ANTES de levantarla | Uso |
|---|---|---|---|---|
| **Pre-seed** | **500–800 k€** (ángeles, family offices, aceleradoras como Lanzadera o Wayra, **ENISA** préstamo participativo, **CDTI Neotec** si hay I+D) | 2–4 M€ | Equipo fundador completo (negocio + CTO); 20–30 entrevistas; prototipo; **3–10 locales usando el producto**; contrato con PSP; opinión legal | MVP profesional, 2 barrios, 12–15 meses de autonomía financiera |
| **Seed** | **2,5–4 M€** (VCs españoles y europeos con foco fintech o software vertical) | 8–15 M€ | 150–300 comercios activos; ARR 250–500 k€; churn < 3 %/mes; LTV/CAC ≥ 3; prueba de canal de venta repetible; volumen de 2–4 M€/mes | Escalar Madrid, 2ª ciudad, equipo comercial, 2ª–3ª integración |
| **Serie A** | **8–15 M€** | 35–60 M€ | ARR 2–4 M€ creciendo >2,5x interanual; 2+ ciudades; NRR ≥ 100 %; margen de contribución positivo por cohorte | Expansión nacional e internacional, plataforma, posible licencia propia |

**Apoyos públicos españoles a investigar** (hay que verificar las convocatorias vigentes):
- **ENISA** (préstamos participativos, requieren fondos propios equivalentes).
- **CDTI Neotec**.
- Beneficios fiscales de la **Ley 28/2022 de Startups** (IS reducido, stock options, certificación ENISA de empresa emergente).
- **Sandbox financiero** (Ley 7/2020), útil si en fase 3 se prueba algo regulado.

---

## 22. Pre-mortem: "fracasamos en octubre de 2029"

| # | Causa probable del fracaso | Señal temprana | Prevención |
|---|---|---|---|
| 1 | **Intentamos construir la superapp** (pagos, reservas, delivery, mapa, P2P…) y no hicimos nada excelente | Hoja de ruta con > 5 frentes; ningún KPI mejora | Un segmento, un trabajo a resolver, un barrio. Decir "no" por escrito |
| 2 | **Los comercios no veían ROI y se daban de baja** (churn > 5 %) | Penetración en el local < 10 %; comercios que no abren el panel | Medir el ROI por comercio (propinas, rotación, repetición) y enseñarlo cada mes; cobrar solo con valor demostrado |
| 3 | **La comisión era más cara que el TPV bancario** y el dueño lo notaba | Objeción de precio en > 50 % de las demos | Precio basado en valor; mezcla SaaS + pagos; cofinanciación de marcas; negociar con el PSP a interchange++ |
| 4 | **Sin integración con software de caja**, el personal tenía que teclear: fricción y abandono | Los camareros no recomiendan el QR | Integrar primero con los softwares de caja del barrio objetivo; aliarse con sus fabricantes |
| 5 | **Bizum, Revolut, Google o un software de caja grande añadieron la misma función** "gratis" | Anuncios de Bizum Pay con fidelización, o del software de caja con pago en mesa | Diferenciar en CRM, campañas y coalición; ser socio (no rival) de los softwares de caja |
| 6 | **Dependencia de un solo PSP**: congeló cuentas, subió precios o cerró el modelo de plataforma | Incidentes de retenciones de fondos | Capa de abstracción de pagos; segundo PSP preparado a partir de 200 comercios; relación contractual negociada |
| 7 | **Problema regulatorio**: puntos considerados dinero electrónico; flujo de fondos fuera de exclusión; sanción de la AEPD por marketing sin consentimiento | Requerimiento del Banco de España o la AEPD | Opinión legal antes del lanzamiento; sin saldo propio; DPIA; consentimientos granulares |
| 8 | **Caja agotada antes de la Serie A**: CAC de campo más alto de lo previsto | Payback > 18 meses | Venta por canal (softwares de caja, distribuidores); disciplina de gasto; 18 meses de autonomía tras cada ronda |
| 9 | **Equipo fundador incompleto** (sin CTO o sin vendedor) o conflicto entre socios | Desarrollo externalizado con retrasos; fundadores sin vender | Pacto de socios con *vesting* (4 años, 1 de carencia); completar el equipo antes de levantar |
| 10 | **Incidente de seguridad o fraude** (QR falsificados, fuga de datos) que destruyó la confianza | Picos de chargebacks; QR pegados encima de los reales | Seguridad desde el diseño, pentest, placas antimanipulación, monitorización, plan de respuesta a incidentes y comunicación |

Riesgos honoríficos (11–13):
- Estacionalidad de la hostelería y cierres de locales.
- Ralentización del turismo.
- Que el euro digital o Wero cambien las reglas del pago presencial en 2028–2029.

---

## 23. Estrategia final: ¿crearía esta empresa?

**Tal como está planteada ("WeChat español"), NO.** Las razones:
- No hay un problema de pago que resolver en España.
- La superapp requiere una base de usuarios que no tienes y que solo Big Tech o los bancos podrían comprar.
- El margen de pagos es mínimo sin licencia.
- La regulación penaliza cualquier función de monedero o P2P.
- Los intentos occidentales de superapp (incluidos X, Uber, PayPal y Revolut) no han replicado WeChat.

**Con cambios, SÍ, aunque con un riesgo alto.** Creo que existe una empresa de 50–150 M€ de valoración posible (no de 10.000 M€) en *software vertical para hostelería con pagos incrustados y fidelización*. Además, tiene salida plausible por adquisición (softwares de caja, adquirentes, bancos, Lightspeed, Toast si entra en Europa, TheFork…).

| Pregunta | Respuesta |
|---|---|
| **¿Con qué MVP?** | Pago y pedido en mesa vía QR **web** (sin app) + dividir cuenta + propinas + puntos y cupones del propio comercio + panel con CRM y repetición. Integración con 1–2 softwares de caja |
| **¿En qué ciudad?** | **Madrid**, pero **2 barrios** (p. ej. Malasaña–Conde Duque y Chamberí) y densidad antes que extensión |
| **¿Con qué segmento?** | Restaurantes independientes y grupos pequeños con servicio en mesa y ticket de 25–60 €. **No** cafeterías, hoteles, peluquerías ni gimnasios en el año 1 |
| **¿Con qué modelo de pagos?** | **PSP de plataforma** (evaluar Stripe Connect, Adyen for Platforms y **Monei** por Bizum y foco español). Tarjetas + Apple/Google Pay + Bizum. Alipay+/WeChat Pay como extra para locales del centro. **Sin saldo, sin P2P, sin licencia propia** hasta superar 1.000–2.000 comercios |
| **¿Con cuánto capital?** | **500–800 k€** de pre-seed para 12–15 meses, hasta 150–250 comercios. Después, seed de 2,5–4 M€ solo si el churn es < 3 % y el payback < 12 meses |
| **¿Con qué estrategia de adquisición?** | Comercios: venta de campo por barrios + alianzas con softwares de caja y distribuidores de bebidas + camareros como promotores (propinas). Usuarios: **adquisición en la mesa** (pago sin registro → "guarda tus puntos"), viralidad de "dividir la cuenta", recompensas financiadas por el comercio |

**Condiciones para seguir (criterios de "matar" el proyecto en el mes 6):**
- Si con 30+ locales la penetración media en el local es < 10 %, **o**
- si el churn es > 5 % mensual, **o**
- si más del 50 % de los comercios no paga tras el periodo gratuito,

**entonces hay que pivotar o parar.** No levantes una seed para "arreglarlo con marketing".

---

## 24. Plan de acción: 20 acciones para los próximos 90 días

**Semanas 1–2: equipo y foco**
1. **Decide el equipo fundador.** Si no hay CTO cofundador, buscarlo es la prioridad nº 1 (comunidades fintech de Madrid, ex-ingenieros de Cabify, Glovo o Fintonic, programas tipo Antler o Wayra). Firmad un pacto de socios con *vesting*.
2. **Escribe en 1 página la tesis reducida** (segmento, barrio, trabajo a resolver, qué NO hacemos) y compártela con 5 personas del sector para que la ataquen.
3. **Mapea los 2 barrios objetivo:** lista de todos los restaurantes (Google Maps + paseo) con ticket estimado, terraza, software de caja visible en el ticket y datáfono usado. Base de 300–500 locales.

**Semanas 2–6: descubrimiento**

4. **30 entrevistas con dueños y encargados de restaurante** (guion fijo: tiempos de cobro, propinas, software de caja, coste del TPV, fidelización actual, TheFork/Glovo, disposición a pagar).
5. **10 entrevistas con camareros** (propinas, fricción al cobrar, qué les haría recomendar una herramienta).
6. **50 encuestas o entrevistas cortas a comensales en mesa** (¿pagarías con QR?, ¿dividís cuenta?, ¿te registrarías por puntos?).
7. **Pide factura de TPV y comisión real** a 10 restaurantes para conocer el listón de precio. **Es el dato más importante que no tienes.**
8. **Prueba con 3 softwares de pago en mesa competidores** (Honei, Qamarero, Cheerfy, Last.app…) como cliente y, si es posible, como "comercio". Documenta precios, integraciones y debilidades.

**Semanas 3–8: proveedores y legal**

9. **Solicita ofertas a 3 PSP de plataforma**: Stripe Connect, Adyen for Platforms, Monei (añade Mangopay o Paycomet si hace falta). Compara precio por método (tarjeta EEE, premium, internacional, Bizum, Alipay+), modelo de verificación de comercios, reservas de fondos, chargebacks, liquidación, mínimos y API.
10. **Habla con 2–3 fabricantes de software de caja de hostelería** sobre API e integración, y explora la alianza de canal.
11. **Encarga una opinión legal escrita** a un despacho fintech sobre:
    - (a) flujo de fondos con PSP de plataforma;
    - (b) puntos y cupones (dinero electrónico o no);
    - (c) red limitada para una futura coalición;
    - (d) GDPR para compartir datos con comercios;
    - (e) VeriFactu (confirmar que no eres sistema de facturación).
12. **Constituye la sociedad (S.L.)**, registra la marca en la OEPM / EUIPO y compra dominios. Valora pedir la certificación de empresa emergente de ENISA (Ley 28/2022).

**Semanas 5–10: prototipo y piloto**

13. **Haz un prototipo navegable en Figma** del flujo QR (escanear → cuenta → dividir → propina → pagar → puntos) y del panel. Pruébalo con 10 comensales y 5 dueños.
14. **Construye el MVP muy básico** (web QR + PSP en pruebas + panel mínimo + importe manual) en 6–8 semanas, con arquitectura preparada para crecer (NestJS + Postgres + Next.js).
15. **Consigue 10 cartas de intención** de restaurantes y **3–5 socios de diseño** que acepten un piloto gratuito con métricas compartidas.
16. **Diseña las placas QR antimanipulación** y el kit de mesa (mensaje de beneficio, no de marca). Haz pruebas A/B del texto.
17. **Prepara privacidad y legal mínimos**: condiciones de uso, política de privacidad, consentimientos granulares, contrato comercio–plataforma (responsabilidad de chargebacks), DPIA preliminar.

**Semanas 9–13: medir y financiar**

18. **Lanza el piloto en 3–5 locales** con un panel de métricas diario: % de mesas pagadas por QR, tiempo de cobro, propina media antes y después, % de registro y repetición.
19. **Modelo financiero en hoja de cálculo** con las hipótesis de §15 sustituidas por datos reales del piloto (comisiones del PSP, penetración, propinas).
20. **Prepara la presentación a inversores pre-seed** con datos del piloto y cita a 20–30 ángeles o fondos pre-seed (fintech o software vertical) **solo cuando tengas ≥3 locales activos y datos de 4+ semanas**. En paralelo, prepara la solicitud ENISA.

---

## Fuentes

**Regulación y organismos oficiales:**
- Real Decreto-ley 19/2018 de servicios de pago (BOE-A-2018-16036): https://www.boe.es/buscar/act.php?id=BOE-A-2018-16036
- Real Decreto-ley 15/2025 (aplazamiento VeriFactu), BOE-A-2025-24446: https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-24446
- Reglamento (UE) 2024/886, pagos instantáneos: https://eur-lex.europa.eu/eli/reg/2024/886/oj
- Reglamento (UE) 2024/1624, AMLR: https://eur-lex.europa.eu/eli/reg/2024/1624/oj
- Reglamento (UE) 2015/751, tasas de intercambio: https://eur-lex.europa.eu/eli/reg/2015/751/oj
- Reglamento Delegado (UE) 2018/389, RTS de SCA: https://eur-lex.europa.eu/eli/reg_del/2018/389/oj
- Banco de España, servicios de pago y registro de entidades: https://www.bde.es
- EBA, directrices sobre exclusión de red limitada (EBA/GL/2022/02): https://www.eba.europa.eu
- AEPD: https://www.aepd.es
- Turespaña, ficha ejecutiva del mercado chino (2026): https://conocimiento.tourspain.es/export/sites/conocimiento/.content/Informes/ficha-ejecutiva/2026/mayo/ficha-ejecutiva-china-mayo-2026.pdf
- Mintur, nota de prensa Frontur/Egatur diciembre 2025: https://www.mintur.gob.es/es-es/gabineteprensa/notasprensa/2026/documents/20260203%20ndp%20frontur%20egatur%20diciembre.pdf

**PSD3/PSR (estado de tramitación, fuentes secundarias; verificar en EUR-Lex):**
- Adyen, PSD3 explained: https://www.adyen.com/knowledge-hub/psd3
- Lexology, PSD3: https://www.lexology.com/library/detail.aspx?g=9f4fcb08-47d8-4d33-b50f-ef73b7c05cba
- PaymentBrief, PSD3 & PSR 2026 timeline: https://paymentbrief.com/articles/psd3-psr-implementation-operator-checklist-2026/
- Open Banking Tracker, PSD3 readiness: https://www.openbankingtracker.com/guides/psd3-psr-readiness
- Matheson, PSD3/PSR: https://www.matheson.com/insights/the-third-payment-services-directive-and-payment-services-regulation/

**Bizum, Wero y euro digital:**
- Infobae, Bizum 2025 (67.751 M€, +53 %): https://www.infobae.com/espana/agencias/2026/01/19/el-volumen-de-operaciones-con-bizum-crecio-un-53-en-2025-y-se-situo-en-67751-millones/
- Roams, Bizum 2025 y planes: https://roams.es/actualidad/finanzas/cada-vez-que-parpadeas-se-hacen-40-bizum-en-espana-asi-fue-su-explosion-en-2025-y-lo-que-prepara-para-este-ano/
- Roams, Bizum en tienda: https://roams.es/actualidad/finanzas/bizum-cumple-10-anos-pagar-amigos-6000-millones-operaciones-pago-tienda/
- Legálitas, Bizum en comercios: https://www.legalitas.com/actualidad/bizum-en-comercios
- EPI–EuroPA: https://epicompany.eu/media-insights/europa-and-epi-launch-collaboration-to-expand-sovereign-pan-european-payments
- Stripe, Wero en España: https://stripe.com/resources/more/wero-in-spain
- Sumsub, euro digital (jul-2026): https://sumsub.com/media/news/digital-euro-proposal-advances-to-final-eu-negotiations/
- PYMNTS, euro digital: https://www.pymnts.com/cbdc/2026/digital-euros-future-unclear-as-key-vote-approaches/

**Alipay+ y turismo:**
- Merca2, Alipay+ en España (2025): https://www.merca2.es/2025/03/03/alipay-pagar-qr-turismo-asiatico-2153638/
- ABANCA + Starpay + Alipay+: https://www.corresponsables.com/social/abanca-y-starpay-se-alian-con-alipay-para-potenciar-las-ventas-de-los-comercios-a-viajeros-internacionales-en-espana-en-plena-temporada-alta-turistica/
- BBVA, Alipay en España: https://www.bbva.com/es/alipay-llega-espana-mano-bbva/
- El Corte Inglés y Alipay+: https://www.iads.org/iads-member-news/el-corte-ingles-introduces-alipay-to-improve-asian-tourists-shopping-experience
- Adyen, pagos locales para turismo chino: https://www.adyen.com/es_ES/knowledge-hub/claves-del-exito-de-los-metodos-de-pago-locales-para-atraer-al-turismo-chino

**Competidores de pago en mesa:**
- Qamarero: https://www.qamarero.com/en/team/
- CB Insights, honei vs Qamarero: https://www.cbinsights.com/compare/honei-vs-qamarero
- Maldita, pago QR en restaurantes y derechos: https://maldita.es/malditatecnologia/20230725/como-funciona-pagar-codigo-qr-derechos-restaurante

**Red limitada (PSD2):**
- Finreg360: https://finreg360.com/alerta/cambia-el-criterio-de-la-norma-espanola-sobre-la-red-limitada-que-recoge-la-psd-2
- Garrigues: https://www.garrigues.com/es_ES/garrigues-digital/excepciones-psd2-red-limitada-volumen-actividad

**Datos que NO he podido verificar y debes confirmar:**
- Comisiones exactas de Stripe, Adyen, Monei, SumUp y Bizum para comercios en España.
- Nº de restaurantes en Madrid ciudad.
- Presencia actual de Sunday en España.
- Disponibilidad de Alipay+/WeChat Pay presencial vía cada PSP.
- Fecha exacta de publicación de PSD3/PSR en el Diario Oficial.
- Estado de FiDA.
