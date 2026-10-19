# CONTEXT: negocio, mercado, regulación y todo lo que no es especificación técnica

> **Estado:** v0.2 (17-oct-2026). El plan de 90 días incluye la PoC local. Resumen de [ANALISIS_PROYECTO.md](ANALISIS_PROYECTO.md), que sigue siendo la fuente detallada con todas las cifras, tablas y fuentes.
>
> **Documentos relacionados:**
> - [SPEC.md](../docs/SPEC.md)
> - [ARCHITECTURE.md](../docs/ARCHITECTURE.md)
> - [DECISIONS.md](../docs/DECISIONS.md)
> - [ROADMAP.md](../docs/ROADMAP.md)
>
> **Etiquetas:** [HECHO] (con fuente en el análisis) · [HIPÓTESIS] · [INCIERTO].
>
> **Aviso:** nada de esto es asesoramiento jurídico. Hay que pedir una opinión escrita a un despacho especializado en fintech antes de operar en vivo.

---

## 1. Tesis y alcance acordado

- **Descartado:** el "WeChat español". Las razones:
  - El pago en España ya está resuelto: tarjeta, NFC, Apple Pay, Google Pay y **Bizum** (30,6 M de usuarios, en tienda desde mayo de 2026) [HECHO].
  - Sin licencia, el margen de pagos es mínimo (las comisiones de intercambio están limitadas por ley al 0,2–0,3 %).
  - La regulación penaliza el monedero y los envíos entre usuarios.
  - Ninguna superapp occidental ha replicado WeChat.
- **Acordado:** software vertical para hostelería con pagos incrustados, *pedir, pagar y volver*:
  - Producto: QR web en la mesa + dividir cuenta + propinas + fidelización y CRM propios del comercio.
  - Segmento: restaurantes independientes con ticket de 25–60 € en 2 barrios de Madrid.
  - Ver [DECISIONS.md › ADR-001](../docs/DECISIONS.md#adr-001).
- **Ambición realista:** una empresa de 50–150 M€ de valoración [HIPÓTESIS]. Salida plausible por adquisición: softwares de caja, adquirentes, bancos, Lightspeed, Toast, TheFork.

## 2. Problema y propuesta de valor

**Para el comercio** (el dolor real):
- Tiempo perdido al cobrar y al dividir cuentas.
- Escasez de personal de sala.
- No conoce a sus clientes, porque el pago con tarjeta es anónimo.
- Dependencia de TheFork y Glovo.

**Lo que *no* es un dolor:** "otra forma de cobrar". Ya tienen un TPV bancario barato.

**Propuesta al comercio:** ROI medible en menos de 60 días:
- más rotación de mesas;
- **más propinas**, que convierten a los camareros en promotores;
- base de clientes propia;
- campañas;
- sin cambiar su software de caja.

**Propuesta al comensal:** "Paga en 10 segundos desde la mesa, divide la cuenta sin calculadora y gana recompensas en tus sitios de siempre". **Sin descargar ninguna app.**

**Lo que el usuario español no necesita:** descubrimiento (ya tiene Google Maps, Instagram y TikTok), pagar en tienda (ya resuelto) ni enviar dinero (ya tiene Bizum).

## 3. Competencia (resumen)

| Grupo | Actores | Relación con nosotros |
|---|---|---|
| Medios de pago | Bizum, Apple Pay, Google Pay, PayPal, Revolut, Wero (EPI; punto de venta previsto para 2026–2027; interconexión con Bizum vía EuroPA por fases [INCIERTO]) | **Los aceptamos** como métodos de pago; no competimos. Revolut es la mayor amenaza a largo plazo como superapp |
| PSP / adquirentes | Stripe, Adyen, Monei, Mangopay, Paycomet, SumUp, Redsys y TPV bancarios (CaixaBank, BBVA, Santander) | Son proveedores. **El TPV bancario (~0,3–0,8 % [HIPÓTESIS]) es el listón de precio** que tenemos que justificar |
| Pago y pedido en mesa (ES/UE) | **Honei** (+300 marcas según la empresa), **Qamarero**, **Cheerfy**, Last.app, Sunday (presencia en España por verificar) | **Competidores directos.** Nos diferenciamos por densidad de barrio, CRM y campañas, integraciones y, en el futuro, la coalición |
| Software de caja de hostelería | Last.app, Revo, Ágora, ICG… | Competidores o **socios de canal** |
| Reservas, delivery, descubrimiento | TheFork, CoverManager, Glovo, Uber Eats, Just Eat, Google Maps | Indirectos. No competir en el MVP |
| Turismo | Alipay+ (BBVA, Sabadell, ABANCA/Starpay, PayXper; El Corte Inglés, Boquería), WeChat Pay | Métodos de pago que aceptar vía PSP (ADR-014) |

Tabla completa en ANALISIS_PROYECTO.md §4.

## 4. Modelo de negocio

| Fuente | ¿MVP? | Notas |
|---|---|---|
| Suscripción SaaS (49–79 €/mes/local) | Sí (2–3 meses gratis) | Ingreso predecible |
| Margen sobre pagos (~0,3–0,5 % neto) | Sí | Margen fino; por sí solo no sostiene la empresa |
| Fidelización y CRM | Sí, básico, incluido en el plan | Diferenciador |
| Campañas por WhatsApp | Fase 2 | Coste por mensaje de Meta + margen |
| Pedidos para llevar | Fase 2 | 3–8 % |
| Patrocinios de marcas de bebida | Fase 2–3 | Canal infravalorado en la hostelería española |
| Comercio destacado / publicidad | Solo con > 20–50 k usuarios activos al mes por ciudad | — |
| Reservas | Más adelante | Competir con TheFork o CoverManager es caro |
| API / mini-apps | Fase 4+ | — |
| Delivery, monedero, cashback | **Nunca** en el horizonte de 3 años | — |

Modelo de precios pendiente de test A/B: [D-05](../docs/DECISIONS.md#d-05).

<a id="regulacion"></a>
## 5. Marco regulatorio (España/UE, oct-2026)

**Estado de las normas clave:**
- **PSD2 + RDL 19/2018:** vigentes.
- **PSD3/PSR:** aprobados en la comisión del Parlamento en mayo de 2026; publicación en el Diario Oficial prevista para finales de 2026; aplicación ~2028 [INCIERTO].
- **Reglamento de pagos instantáneos (UE 2024/886):** vigente.
- **Límites a las comisiones de intercambio (UE 2015/751):** vigentes.
- **Prevención del blanqueo:** Ley 10/2010 vigente; el reglamento europeo AMLR (2024/1624) aplica desde el 10-jul-2027.
- **Privacidad y comunicaciones:** GDPR, LOPDGDD y LSSI.
- **Autenticación reforzada (SCA):** RTS 2018/389.
- **Accesibilidad:** Ley 11/2023 (Acta Europea de Accesibilidad), aplicable desde junio de 2025.
- **VeriFactu:** 1-ene-2027 (sociedades) y 1-jul-2027 (resto) [HECHO].
- **Euro digital:** en negociación interinstitucional desde julio de 2026; pilotos a partir de mediados de 2027 si se adopta [INCIERTO].

**A) Lo que podemos hacer como empresa tecnológica (sin licencia):**
- software de carta, pedidos, CRM, analítica y campañas;
- QR que llevan a la página de pago del PSP;
- cuota SaaS y comisión de plataforma descontada por el PSP;
- puntos gratuitos, que no se compran ni se canjean por dinero y valen solo en el comercio emisor [HIPÓTESIS jurídica];
- cupones financiados por el comercio.

**B) Lo que requiere un proveedor regulado:**
- aceptar pagos;
- verificación de comercios (KYB) y prevención del blanqueo;
- liquidación, reembolsos y chargebacks;
- propinas (entran en el pago al comercio);
- iniciación de pagos por Open Banking;
- Tap to Pay;
- tarjetas regalo prepago.

**C) Lo que requeriría licencia propia:**
- Recibir y redistribuir fondos (entidad de pago o agente).
- Monedero o saldo (entidad de dinero electrónico, con capital mínimo de 350 k€).
- Envíos entre usuarios.
- Puntos que se compran o se canjean por dinero.
- Crédito o "paga después".
- Cambio de divisa.
- Cripto (MiCA).
- Coalición multi-comercio: revisar la exclusión de **red limitada** (obliga a notificar al Banco de España si se superan 1 M€ en 12 meses) [HECHO].

Cómo se traduce esto en requisitos del sistema: [SPEC.md §4](../docs/SPEC.md#4-restricciones-regulatorias-convertidas-en-requisitos).

**Preguntas para la opinión legal:**
1. El flujo de fondos con el PSP de plataforma.
2. La naturaleza de los puntos y cupones.
3. La red limitada para una futura coalición.
4. GDPR al compartir datos con los comercios (¿corresponsabilidad del tratamiento?).
5. Confirmar que no somos un sistema de facturación sujeto a VeriFactu.
6. El tratamiento de las propinas.

## 6. Salida al mercado en Madrid

**Comercio objetivo (perfil ideal):**
- Restaurante independiente o grupo de 1–5 locales, con servicio en mesa.
- Ticket de 25–60 €, 60–200 cubiertos al día, con terraza.
- Software de caja en la nube con API.
- Dueño de 28–50 años.

**A evitar en el año 1:** cafeterías, cadenas, hoteles, peluquerías y gimnasios.

**Barrios candidatos** [HIPÓTESIS]: Malasaña–Conde Duque, Chamberí (Ponzano, Trafalgar), Lavapiés–La Latina; Salamanca como alternativa.

**Objetivos de densidad:**

| Mes | Comercios activos | Zona |
|---|---|---|
| 3 | 10–15 socios de diseño | — |
| 6 | 50 | 2 barrios |
| 12 | 150–250 | — |
| 18–24 | 500–1.000 | + 2.ª ciudad |

**Primeros 100 comercios:**
1. Entrevistas de descubrimiento.
2. Socios de diseño con 6 meses gratis.
3. Venta puerta a puerta entre servicios (16:00–19:30).
4. Alianza con fabricantes de software de caja.
5. Distribuidores de bebidas.
6. Asociaciones (Hostelería Madrid).
7. Gestorías (VeriFactu como gancho).
8. Prueba social por calle.
9. Camareros como promotores (propinas).
10. Garantía de devolución de la cuota a 60 días.

**Primeros 1.000 usuarios:** se adquieren **en la mesa**. Con 15 locales × ~1.500 comensales/mes × 20 % de pago por QR × 20–25 % de registro ≈ 1.000 usuarios al mes [HIPÓTESIS].
- Pago sin registro y "guarda tus puntos" después.
- Primera recompensa rápida, financiada por el comercio.
- Tarjeta en Wallet.
- Cartelería con mensaje de beneficio.
- **Sin cashback financiado por nosotros.**

**Bucles de crecimiento:**
- Dividir la cuenta es viral: el resto de la mesa ve el flujo.
- Referidos de comercio a comercio (2 meses gratis).
- Usuario → "quiero que mi bar esté aquí" → lead para ventas.

**Efecto red:** al principio es débil y local; primero hay que dar valor "de un solo jugador" a cada comercio. La coalición de barrio llega en la fase 12–24 m. El foso defensivo real son las integraciones con software de caja, los datos de CRM y el coste de cambio para el comercio.

## 7. Turismo

- **Datos 2025** [HECHO, Turespaña/INE]:
  - ~795.500 turistas chinos (+22,6 %) y ~2.200 M€ de gasto.
  - 2.775 € por persona y 459 € por persona y día.
  - Cataluña 56 %, Comunidad de Madrid 27 %.
  - Representan el 0,8 % de los ~96,8 M de turistas.
- En Madrid son ≈ 215 k turistas chinos al año [HIPÓTESIS]. La parte capturable en restauración independiente es de decenas de millones de euros.
- Alipay+ ya se acepta en España (BBVA, Sabadell, ABANCA/Starpay, PayXper; El Corte Inglés, la Boquería, Freenow).
- **Veredicto:** es una funcionalidad (carta multiidioma + Alipay+/WeChat Pay vía PSP + distintivo "Alipay accepted") para los locales del centro, y llega en la fase 6–12 m. **No es un nicho de lanzamiento**:
  - es estacional;
  - la distribución la controlan Ant y Tencent (Xiaohongshu, Dianping, la sección de descubrimiento de Alipay);
  - el turista no repite;
  - hay riesgo geopolítico.

<a id="kpis"></a>
## 8. KPIs: definiciones

| KPI | Definición | Objetivo año 1 [HIPÓTESIS] |
|---|---|---|
| Comercios activos | ≥ 50 pagos en 30 días | 150–250 |
| Usuarios activos (MAU) | Registrados con ≥ 1 pago o canje en 30 días | 15–30 k |
| Volumen procesado | Valor cobrado vía el PSP, incluidas propinas | 2–3 M€/mes al cierre |
| Penetración en el local | % de mesas o tickets pagados por QR | ≥ 25 % |
| Retención de comercios | Activos en M que siguen activos en M+3 | ≥ 90 % |
| Retención de usuarios | Vuelven a pagar en M1 / M3 | 35 % / 25 % |
| Frecuencia | Pagos al mes por usuario activo | ≥ 2 |
| Repetición en el comercio | Clientes identificados que vuelven en 60 días | ≥ 30 % |
| CAC comercio / usuario | — | ≤ 900 € / ≤ 2 € |
| LTV / CAC | — | ≥ 3 |
| Churn de comercios | — | < 3 % mensual |
| Conversiones | Escaneo → pago / pago → registro / demo → alta | 70 % / 20 % / 30 % |
| Comisión neta de pagos | Ingresos netos de pagos / volumen procesado | ≥ 0,35 % |
| Margen bruto | — | ≥ 65 % |
| Disputas y fraude | Disputas / transacciones | < 0,3 % |

## 9. Economía unitaria (hipótesis base)

| Variable | Valor [HIPÓTESIS] |
|---|---|
| Facturación del restaurante | 45 k€/mes |
| % vía ComerceChat | 25 %, es decir ~11.250 €/mes por local |
| Precio de pagos al comercio | 1,9 % + 0,10 € |
| Coste del PSP | ~1,4 % + 0,15 € |
| **Margen neto de pagos** | ≈ 0,36 % del volumen ≈ 40 €/mes por local |
| Cuota SaaS | 59 €/mes |
| Otros ingresos | 6 €/mes |
| **Ingreso por comercio** | **≈ 105 €/mes** |
| Coste directo | 25 €/mes |
| **Margen bruto** | **≈ 80 €/mes (76 %)** |
| Churn | 3 % mensual |
| CAC | 900 € |
| **LTV** | **≈ 2.670 €** |
| **LTV/CAC** | **≈ 3x** |
| **Payback** | **≈ 11 meses** |

**Sensibilidad:** con un churn del 5 %, el LTV/CAC cae a 1,8x y el negocio deja de ser viable. **El churn es la métrica nº 1.**

**Punto de equilibrio:** ≈ 3.500–4.500 comercios activos con una estructura de ~2,6–3,0 M€/año. Eso obliga a expandirse a otras ciudades.

**Tickets pequeños:** con una tarifa de 1,5 % + 0,25 €, un café de 2,50 € paga ~11,5 % de comisión. Por eso las cafeterías quedan excluidas.

<a id="costes"></a>
## 10. Costes, finanzas y financiación

**Coste de desarrollo:**

| Versión | Coste |
|---|---|
| MVP muy básico | 55–100 k€ |
| MVP profesional | 290–535 k€ |
| Plataforma escalable | 1,8–3,1 M€/año en producto y tecnología |

Desglose por partidas en ANALISIS_PROYECTO.md §16.

**Escenarios a 3 años** (M€; comercios a fin de año / ingresos / EBITDA):

| Escenario | Año 1 | Año 2 | Año 3 | Financiación acumulada |
|---|---|---|---|---|
| Pesimista | 60 / 0,03 / −0,67 | 300 / 0,20 / −1,30 | 800 / 0,65 / −1,55 | 3,5 (no levanta Serie A) |
| Base | 150 / 0,08 / −0,82 | 900 / 0,60 / −1,60 | 3.000 / 2,40 / −1,60 | 4,1 |
| Optimista | 300 / 0,15 / −0,95 | 2.000 / 1,40 / −1,80 | 6.500 / 5,80 / −1,00 | 3,9 |

No hay EBITDA positivo antes del año 4 en ningún escenario.

**Rondas:**

| Ronda | Importe | Hitos previos |
|---|---|---|
| Pre-seed | **500–800 k€** (ángeles, aceleradoras, ENISA, CDTI Neotec) | Equipo con CTO, piloto en 3–10 locales, PSP contratado, opinión legal |
| Seed | **2,5–4 M€** | 150–300 comercios, ARR 250–500 k€, churn < 3 %, LTV/CAC ≥ 3 |
| Serie A | **8–15 M€** | ARR 2–4 M€, 2+ ciudades, retención neta de ingresos ≥ 100 % |

**Apoyos a investigar:**
- Certificación de empresa emergente de ENISA (Ley 28/2022 de Startups).
- Sandbox financiero (Ley 7/2020).

## 11. Equipo

- **Imprescindibles desde el inicio:** CEO o fundador comercial (vende las primeras 100 altas en persona) y **CTO cofundador** (no externalizable).
- **Equipo mínimo de lanzamiento:** 4–5 personas a tiempo completo + diseño y legal externos.
- **Perfil de comercial ideal:** ex-comercial de distribuidor de bebidas o de software de caja.
- **Soporte:** en horario de hostelería, incluidas noches y fines de semana, por WhatsApp.

## 12. Pre-mortem: las 10 causas de fracaso más probables

1. Construir la superapp en vez de una cosa excelente.
2. Comercios sin ROI que se dan de baja (churn > 5 %).
3. Comisión percibida como más cara que el TPV bancario.
4. Sin integración con el software de caja, fricción para el personal.
5. Bizum, Revolut, Google o un software de caja grande copian la función gratis.
6. Dependencia de un solo PSP.
7. Problema regulatorio (puntos considerados dinero electrónico, flujo de fondos, AEPD).
8. Caja agotada por un CAC de campo alto.
9. Equipo fundador incompleto o conflicto entre socios.
10. Incidente de seguridad o fraude (QR falsificados, fuga de datos).

Prevención de cada una en ANALISIS_PROYECTO.md §22.

**Medidas físicas contra QR falsificados** (complementan los controles técnicos de ARCHITECTURE §9):
- Placas de metacrilato o etiquetas que se rompen al despegarlas.
- Foto de referencia de cada placa en el panel.
- Revisión periódica por el personal.
- Educación del comensal ("comprueba que ves *pay.comercechat.es*").

<a id="plan-90-dias"></a>
## 13. Plan de acción: próximos 90 días (negocio + producto)

1. Cerrar el equipo fundador (CTO) y firmar un pacto de socios con *vesting*.
2. Tesis de una página, puesta a prueba por 5 personas del sector.
3. Mapear los 2 barrios: 300–500 locales con ticket, terraza, software de caja y TPV.
4. 30 entrevistas con dueños y encargados.
5. 10 entrevistas con camareros.
6. 50 encuestas a comensales.
7. **Conseguir facturas de TPV y comisiones reales** de 10 restaurantes.
8. Probar como cliente a los competidores (Honei, Qamarero, Cheerfy, Last.app).
9. Pedir ofertas a 3 PSP → [D-01](../docs/DECISIONS.md#d-01).
10. Hablar con 2–3 fabricantes de software de caja → [D-02](../docs/DECISIONS.md#d-02).
11. Encargar la opinión legal (preguntas en §5).
12. Constituir la S.L., registrar la marca (OEPM/EUIPO) y los dominios; solicitar la certificación de ENISA.
13. **PoC local** ([ROADMAP §2](../docs/ROADMAP.md#poc), semanas 1–4) en paralelo con las acciones 3–11. Sustituye al prototipo de Figma como herramienta de demo: se prueba con 10 comensales y 5 dueños desde sus propios móviles. (Figma solo para explorar pantallas antes de programarlas.)
14. MVP muy básico (hitos M0–M1 del [ROADMAP](../docs/ROADMAP.md)), construido sobre el código de la PoC.
15. 10 cartas de intención y 3–5 socios de diseño.
16. Placas QR antimanipulación y kit de mesa, con test A/B del texto.
17. Términos, política de privacidad, consentimientos, contrato con el comercio y DPIA preliminar.
18. Piloto en 3–5 locales con métricas diarias.
19. Modelo financiero actualizado con los datos reales del piloto.
20. Presentación a inversores pre-seed (con ≥ 3 locales y 4+ semanas de datos) + solicitud de ENISA.

## 14. Visión a largo plazo (fuera del alcance actual)

Solo si se consigue densidad (más de 1.000 comercios y varias ciudades):
- Coalición de puntos de barrio y luego de ciudad.
- Descubrimiento y publicidad local.
- Patrocinios de marcas.
- Reservas y pedidos para llevar.
- API pública y mini-apps de terceros.
- Posible licencia propia o figura de agente de entidad de pago.
- Expansión a Portugal.

Es la parte "superapp" de la idea original, y se plantea como **resultado posible, no como punto de partida**.

**Eventos regulatorios a vigilar en 2027–2028:**
- PSR/PSD3: cooperación de plataformas contra el fraude y transparencia de comisiones.
- Euro digital: aceptación obligatoria en el punto de venta.
- Wero y Bizum en punto de venta paneuropeo.
- Aplicación del AMLR.

## 15. Datos pendientes de verificar

- Comisiones reales de Stripe, Adyen, Monei, SumUp y Bizum para comercios en España.
- Número de restaurantes en Madrid ciudad y en los barrios objetivo.
- Presencia actual de Sunday en España.
- Alipay+/WeChat Pay en punto de venta vía cada PSP.
- Fecha de publicación de PSD3/PSR en el Diario Oficial.
- Estado de FiDA (regulación europea de acceso a datos financieros).
- Plazos legales de conservación de registros financieros (NFR-09).
- Valores de conversión y penetración (se medirán en el piloto).

Fuentes completas: ANALISIS_PROYECTO.md, sección "Fuentes".
