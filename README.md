# Matemática Financiera

Matemática Financiera es un entorno interactivo diseñado para explorar, comprender y aplicar los principios del cálculo financiero mediante modelos matemáticos, simulaciones y representaciones gráficas.

Cada herramienta reúne cuatro elementos:

1. una **explicación conceptual** clara;
2. la **fórmula** matemática utilizada;
3. el **desarrollo numérico paso a paso**, con sustitución de valores;
4. una **representación gráfica interactiva** que responde de inmediato a los cambios.

El principio de trabajo es: **modificar una variable, visualizar su efecto, comprender la relación matemática y verificar el resultado.**

**Aplicación en línea:** <https://alanartola.github.io/matematica-financiera/>

Funciona directamente en el navegador (Chrome u otro navegador moderno), en computadoras y celulares, sin instalar nada.

---

## Índice

1. [Presentación](#1-presentación)
2. [Objetivos pedagógicos](#2-objetivos-pedagógicos)
3. [Módulos](#3-módulos)
4. [Funcionalidades](#4-funcionalidades)
5. [Interacción con los gráficos](#5-interacción-con-los-gráficos)
6. [Fórmulas financieras](#6-fórmulas-financieras)
7. [Convenciones matemáticas](#7-convenciones-matemáticas)
8. [Instalación](#8-instalación)
9. [Ejecución local](#9-ejecución-local)
10. [Arquitectura técnica](#10-arquitectura-técnica)
11. [Pruebas](#11-pruebas)
12. [Limitaciones conocidas](#12-limitaciones-conocidas)
13. [Estructura de carpetas](#13-estructura-de-carpetas)
14. [Ampliaciones futuras](#14-ampliaciones-futuras)

---

## 1. Presentación

La aplicación funciona como un laboratorio de matemática financiera pensado para explicar en una pantalla proyectada: los controles y el gráfico principal permanecen visibles a la vez, la tipografía es grande, los ejes indican variable y unidad, y un **modo clase** amplía todo para la proyección.

Toda la interfaz, los textos, las fórmulas comentadas, las tablas y los archivos exportados están en español, con formato numérico argentino (`$ 1.234.567,89`, `3,25 %`).

## 2. Objetivos pedagógicos

- Mostrar cómo evoluciona el dinero en el tiempo bajo distintos regímenes de interés.
- Distinguir con precisión tasas nominales, periódicas y efectivas, y sus equivalencias.
- Construir y leer cuadros de marcha de los sistemas de amortización.
- Analizar qué ocurre cuando un préstamo cambia de sistema, de tasa o recibe pagos extraordinarios.
- Plantear problemas inversos y reconocer cuándo los datos alcanzan (o no) para una solución única.
- Comparar importes ubicados en distintos momentos: valor actual, valor futuro, VAN y TIR.
- Aplicar los conceptos a operaciones bancarias habituales en la Argentina, sin confundir rendimientos de un plazo con tasas anuales.

## 3. Módulos

| Módulo | Temas |
|---|---|
| **1. Tasas de interés y capitalización** | Interés simple · Interés compuesto · Tasas efectivas equivalentes · TNA · TEA (directa e inversa, límite continuo, convenciones por días) · Comparador de tasas |
| **2. Sistemas de amortización** | Francés · Alemán · Americano · Americano Bullet (compuesto capitalizado o simple acumulado) · Comparador de los cuatro sistemas |
| **3. Laboratorio de préstamos** | Simulador con múltiples cambios de sistema, cambios de tasa y pagos extraordinarios · Reconstrucción del capital original · Tasa implícita, plazo, saldo y capital a partir de una cuota |
| **4. Valor temporal del dinero** | Valor actual · Valor futuro · VAN (períodos uniformes o fechas) · TIR con perfil del VAN · Línea de tiempo financiera |
| **5. Aplicaciones bancarias** | Plazo fijo · Comparador de alternativas · Préstamo con IVA, seguros, gastos y CFT estimado |
| **6. Ejercicios interactivos** | Problemas por nivel y temática con parámetros modificables y resolución guiada |

## 4. Funcionalidades

**Comunes a todas las herramientas**

- Barras deslizantes sincronizadas con campos numéricos que aceptan importes exactos escritos con teclado (`10.000.000`, `1.234,56`, `3,5`).
- Botón **Restablecer valores**.
- Pestañas para alternar explicación, fórmulas, desarrollo, cuadro de marcha y verificaciones sin sobrecargar la pantalla.
- **Modo claro / oscuro** (tecla `T`) y **modo clase** (tecla `P`).
- Diseño adaptable: en pantallas de escritorio, panel de variables a la izquierda, gráfico al centro y panel de explicación a la derecha (desde 1280 px) o debajo.

**Módulo 1**

- Marcador de período con capital inicial, interés acumulado y valor futuro; barras que separan capital e intereses.
- *Escala fija*: el eje vertical no se reajusta al mover las barras, para que el cambio de pendiente sea visible. *Curva de referencia* para comparar antes y después.
- Interés simple frente a compuesto con sombreado del capital, de los intereses o de la diferencia, y descomposición del monto en capital, interés sobre el capital inicial e interés sobre interés. Desarrollo período a período.
- Tasas efectivas equivalentes para cualquier periodicidad y trayectorias escalonadas que llegan al mismo monto.
- Línea de tiempo de la TNA con interés retirado frente a reinvertido.
- TEA según la frecuencia (anual a diaria y límite continuo), cálculo inverso TEA → TNA y tabla de convenciones uniformes frente a días efectivos.
- Comparador de dos alternativas con capital y horizonte comunes y supuestos explícitos.

**Módulo 2**

- Cuadro de marcha generado por el motor, con selección de cuota y desarrollo exacto de su cálculo.
- Composición de la cuota (barras apiladas), saldo pendiente, intereses y amortizaciones acumulados; comparación superpuesta con otro sistema.
- Convenciones de interés por períodos uniformes o por días (ACT/365, ACT/360, 30/360) con fecha de desembolso y redondeo a centavos o exacto.
- Exportación a **CSV** (separador `;`, coma decimal) y **Excel (.xlsx)**.
- Comparador que explica la diferencia de intereses mediante la suma de saldos adeudados (área bajo la curva de saldo), aclarando que no es un CFT regulatorio.

**Módulo 3**

- Escenarios de ejemplo (francés → alemán → francés; tasas 30 % → 35 % → 40 %; pago extraordinario) y editor libre de modificaciones sin límite de cantidad.
- Tramos sombreados y rotulados por sistema, líneas verticales en cada transición, cambio de tasa o pago extraordinario, y comparación contra el préstamo original.
- Impacto de cada modificación: saldo pendiente, cuota siguiente, amortización, interés e intereses futuros.
- Verificación de que las cuotas anteriores a la primera modificación no cambian y de que la deuda se cancela.
- Reconstrucción del capital original con diagnóstico: solución única, capital identificado sin plazo, múltiples soluciones (y dato faltante), datos insuficientes o ninguna solución (con causas posibles). Contempla IVA sobre intereses, seguro sobre saldo y cargo fijo.

**Módulo 4**

- Línea de tiempo con flechas proporcionales (ingresos hacia arriba, egresos hacia abajo) y fecha focal para valores equivalentes.
- VAN con flujos editables por período o por fecha; flujo original frente a descontado y VAN acumulado.
- TIR con perfil del VAN, todas las raíces del rango explorado, registro de iteraciones y advertencias de múltiples TIR o ausencia de TIR; anualización.

**Módulo 5**

- Plazo fijo con base 365/360, fecha de vencimiento, rendimiento del plazo frente a TEA según los días y simulación de renovaciones.
- Comparador de alternativas con entidad, TNA, plazo, base, fuente y fecha de consulta. **No se incluyen tasas vigentes**: los valores iniciales son hipotéticos y así se rotulan.
- Préstamo con cargos y CFT estimado expresado como tasa efectiva y nominal anual.

**Módulo 6**

- 15 ejercicios en niveles inicial, intermedio y avanzado y diez temáticas.
- Botones **Resolver paso a paso**, **Mostrar pista**, **Ver fórmula**, **Ver gráfico**, **Comprobar respuesta**, **Reiniciar ejercicio** y **Abrir en simulador**.
- Etapas: enunciado, datos conocidos, incógnita, fórmula, sustitución, desarrollo, resultado, interpretación y visualización.

## 5. Interacción con los gráficos

- **Pasar el cursor** sobre un punto o una barra muestra el detalle (sistema, tasa aplicada, cuota, amortización, interés, saldo, según el gráfico).
- **Hacer clic** en un período o una cuota la selecciona: se actualizan el marcador, los indicadores superiores y el desarrollo paso a paso.
- Los selectores sobre el gráfico alternan visualizaciones (por ejemplo *Composición de la cuota · Saldo · Acumulados*).
- Los ejes indican siempre la variable y la unidad; las escalas se ajustan a valores "limpios".
- **Escala fija** y **Fijar referencia** (Módulo 1) permiten mostrar el efecto de un cambio sin que el reescalado lo disimule.
- El panel de explicación puede ocultarse para ampliar el gráfico durante una presentación.

## 6. Fórmulas financieras

Notación: `C₀` capital, `i` tasa efectiva del período, `n` cantidad de períodos, `m` capitalizaciones por año, `d` días.

| Concepto | Fórmula |
|---|---|
| Interés simple | `I = C₀ · i · n` · `VF = C₀ (1 + i n)` |
| Interés compuesto | `VF = C₀ (1 + i)ⁿ` |
| Tasa periódica de una TNA | `j = TNA / m` |
| TNA → TEA | `TEA = (1 + TNA/m)^m − 1` |
| TEA → TNA | `TNA = m [(1 + TEA)^(1/m) − 1]` |
| Límite continuo | `TEA = e^TNA − 1` |
| Equivalencia de tasas efectivas | `(1 + i_a)^(m_a) = (1 + i_b)^(m_b)` |
| Sistema francés | `c = C₀ · i (1+i)ⁿ / [(1+i)ⁿ − 1]` · `I_k = S_{k−1} i` · `A_k = c − I_k` |
| Sistema alemán | `A = C₀ / n` · `I_k = S_{k−1} i` · `c_k = A + I_k` |
| Sistema americano | `c_k = C₀ i` (k < n) · `c_n = C₀ (1 + i)` |
| Bullet | compuesto: `C₀ (1+i)ⁿ` · simple: `C₀ (1 + i n)` |
| Plazo (francés) | `n = −ln(1 − P i / c) / ln(1 + i)` |
| Valor actual / futuro | `VA = VF / (1+i)ⁿ` · `VF = VA (1+i)ⁿ` |
| VAN | `VAN = Σ FC_t / (1+i)^t` · con fechas: `Σ FC_k / (1+TEA)^(d_k/365)` |
| TIR | tasa `r` tal que `VAN(r) = 0` · anual: `(1 + r)^m − 1` |
| Plazo fijo | `I = C · TNA · d / base` · `TEA = (1 + TNA·d/base)^(365/d) − 1` |
| CFT estimado | TIR del flujo neto del deudor · `CFTEA = (1 + r)^m − 1` |

## 7. Convenciones matemáticas

**Precisión.** El motor calcula con `decimal.js` (40 dígitos significativos). Los resultados se convierten a número de punto flotante sólo para mostrarlos y graficarlos. Los importes conservan exactitud de centavos hasta unos $ 90 billones (9 × 10¹³); por encima, el motor lo advierte.

**Redondeo (modo "a centavos", predeterminado).**
- El interés de cada período se redondea a centavos, mitad hacia arriba.
- La cuota francesa y la amortización alemana se redondean a centavos al calcularse.
- **La última cuota absorbe la diferencia de redondeo**: amortiza exactamente el saldo pendiente y la deuda termina en cero. Por eso puede diferir en algunos centavos de las demás.
- El modo "sin redondeo" mantiene precisión completa en todas las filas.

**Tolerancia monetaria.** Medio centavo para considerar cancelado un saldo; las verificaciones admiten un centavo adicional cuando la tasa se transporta como número.

**Períodos uniformes.** Las conversiones TNA/TEA y entre tasas efectivas suponen que el año se divide en `m` subperíodos iguales (12 meses, 4 trimestres, 52 semanas, 365 días). La capitalización continua se incluye como límite matemático.

**Días efectivos.** Con las convenciones ACT/365, ACT/360 o 30/360 (europea, 30E/360) el interés de un período es `saldo · TNA · días / base` (con TEA: `saldo · [(1+TEA)^(días/base) − 1]`). Las fechas de vencimiento se obtienen sumando meses a la fecha de desembolso respetando el fin de mes (31/01 + 1 mes = 28/02 o 29/02). La cuota francesa se calcula con la tasa periódica uniforme y la última cuota ajusta. Las dos convenciones no se mezclan.

**Anualización de plazos fijos.** El rendimiento de un plazo se anualiza con un año calendario de 365 días, independientemente de la base contractual.

**Cambios durante el préstamo.** Un cambio de sistema o de tasa rige desde la cuota indicada; un pago extraordinario se paga junto con la cuota indicada y se imputa a capital. Al abandonar un tramo Bullet, los intereses devengados y no pagados se capitalizan. Al cambiar la tasa en el sistema francés se recalcula la cuota con el saldo y el plazo restantes; en el alemán se mantiene la amortización. Con *reducir plazo* se conserva la cuota vigente y la última resulta menor.

**Signos de los flujos.** Ingresos positivos y egresos negativos; el flujo de un préstamo se analiza desde el punto de vista del deudor (+capital en t = 0, −pagos luego).

**TIR.** Se exploran tasas entre −99 % y 1000 % por período; cada cambio de signo del VAN se refina con Newton-Raphson protegido por bisección.

**Cálculo inverso del capital.** Para `n` y tasa fijos, cada cuota es lineal en el capital (`c_k = P·g_k + f`), de modo que el capital se estima por mínimos cuadrados y la calidad del ajuste indica compatibilidad (tolerancia predeterminada: $ 1 por cuota, configurable). Si `n` es desconocido se exploran hasta 480 cuotas. Cuando un capital "redondo" cercano reproduce las cuotas al centavo, se informa ese valor junto con la estimación algebraica.

## 8. Instalación

Requisitos: **Node.js 20.19 o superior** (desarrollado con Node 24) y npm.

```bash
git clone https://github.com/alanartola/matematica-financiera.git
cd matematica-financiera
npm install
```

Para las pruebas de interfaz, instalar el navegador de Playwright (una sola vez):

```bash
npx playwright install chromium
```

## 9. Ejecución local

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo en `http://localhost:5173` |
| `npm run build` | Verificación de tipos y compilación en `dist/` |
| `npm run preview` | Sirve la compilación en `http://localhost:4173` |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:e2e` | Pruebas de interfaz (Playwright; compila y levanta la vista previa automáticamente) |
| `npm run test:all` | Tipos + pruebas unitarias + pruebas de interfaz |
| `npm run format` | Formato del código con Prettier |

La compilación usa el prefijo `/matematica-financiera/` (`base` en `vite.config.ts`), el mismo de GitHub Pages; `npm run preview` la sirve en `http://localhost:4173/matematica-financiera/`. La navegación interna usa el fragmento de la URL (`#/modulo/tema`), por lo que no hace falta configurar redirecciones en el servidor.

### Publicación en GitHub Pages

El flujo `.github/workflows/deploy.yml` se ejecuta en cada actualización de la rama `main` (y también manualmente desde la pestaña *Actions*): instala dependencias, ejecuta las pruebas unitarias, compila y publica `dist/` en GitHub Pages. Si alguna prueba falla, no se publica.

Para probar el sitio publicado con Playwright:

```bash
E2E_BASE_URL=https://alanartola.github.io/matematica-financiera/ npx playwright test
```

## 10. Arquitectura técnica

**Tecnologías:** React 19 · TypeScript 5.9 · Vite 8 · Recharts 3 (gráficos cartesianos) · SVG propio (líneas de tiempo) · KaTeX (fórmulas) · decimal.js (precisión) · fflate (empaquetado .xlsx) · Vitest · Playwright · Prettier.

Decisiones principales:

- **Separación en capas.** El motor (`src/engine`) no depende de React; la capa de simulación (`src/simulation`) compone resultados del motor en escenarios y series; los gráficos (`src/charts`) sólo dibujan datos recibidos; el contenido pedagógico (`src/content`) contiene textos, fórmulas y desarrollos; las páginas (`src/modules`) conectan todo. Ningún gráfico implementa fórmulas propias.
- **Un único motor de cuadros de marcha** (`buildSchedule`) resuelve los cuatro sistemas, los cambios de sistema y de tasa, los pagos extraordinarios y las convenciones por días. El Módulo 2, el laboratorio, los cálculos inversos, los préstamos bancarios y los ejercicios lo reutilizan.
- **Verificaciones automáticas** (`validateSchedule`) acompañan cada cuadro y se muestran en la interfaz.
- **Registro de módulos** (`src/modules/registry.ts`) con carga diferida: agregar una herramienta consiste en crear su página y registrarla.
- **Exportación Excel propia:** genera un .xlsx OpenXML mínimo con celdas numéricas reales, sin bibliotecas de hojas de cálculo.
- **Paleta de gráficos** categórica validada para daltonismo en pares adyacentes, con variantes para modo claro y oscuro.
- **Sin servidor:** todo se calcula en el navegador; no se envían datos a ningún servicio.

## 11. Pruebas

**Unitarias (Vitest) — 124 pruebas.**

- Conversión de tasas: TNA/TEA directa e inversa para todas las frecuencias, límite continuo, equivalencias encadenadas, tasa cero.
- Interés simple y compuesto, incluido el caso `0 < n < 1`.
- Cuadros de marcha de los cuatro sistemas: cuotas, composición, tasa cero, plazo mínimo de una cuota, capitales con centavos, 360 cuotas, modo exacto.
- Cambios múltiples de sistema (incluido pasar por Bullet y capitalizar intereses), cambios de tasa, pagos extraordinarios con reducción de cuota o de plazo, pagos mayores al saldo.
- Convenciones ACT/365, ACT/360 y 30/360, fin de mes y años bisiestos.
- Batería determinística de 150 configuraciones aleatorias: todas las verificaciones deben cumplirse.
- Verificaciones: saldo final cero, suma de amortizaciones igual al capital, continuidad, interés sobre el saldo correcto, cuota = interés + amortización, ausencia de saldos negativos, historia intacta.
- VAN, TIR (única, dos raíces, inexistente, fechas), plazo fijo, CFT.
- Cálculo inverso: solución única, múltiple, capital identificado sin plazo, posiciones conocidas, cargos incluidos, tasas incompatibles.
- Laboratorio, exportación CSV/XLSX, lectura de números en formato argentino y resolución de todos los ejercicios con parámetros mínimos, predeterminados y máximos.

**Interfaz (Playwright) — 99 pruebas en 1366 × 768, 1920 × 1080 y celular (Pixel 7).**

- Todas las pantallas: sin errores de consola, sin desplazamiento horizontal, panel de variables y gráfico visibles a la vez dentro de la pantalla (en escritorio), gráfico de al menos 240 px de alto, sin elementos fuera del contenedor y tipografía de al menos 15 px.
- Interacciones: campos y barras, importes escritos con separadores, valores esperados (cuota francesa $ 458.037,94; TEA 42,5761 %), cuadro de marcha, verificaciones, descarga CSV y Excel, laboratorio, cálculo inverso, ejercicios, modo clase y modo oscuro.

## 12. Limitaciones conocidas

- **Tasas bancarias:** no se consultan tasas vigentes; todos los valores se ingresan manualmente.
- **CFT:** es una estimación con los conceptos cargados (IVA, seguro, gastos, comisión); no reemplaza el CFT informado por la entidad ni contempla todos los criterios regulatorios.
- **Guía de ejercicios de referencia:** aún no se incorporó porque no estaba disponible; los ejercicios actuales son propios. La estructura para incorporarla está documentada en `src/content/ejercicios/guia.ts`.
- **Convención por días:** disponible para periodicidades de meses enteros (mensual a anual); las cuotas francesas se calculan con la tasa periódica y la última ajusta.
- **TIR:** sólo se buscan raíces entre −99 % y 1000 % por período; las raíces tangentes (sin cambio de signo del VAN) no se detectan.
- **Cálculo inverso:** supone tasa fija, sin cambios ni pagos extraordinarios durante la operación, y explora hasta 480 cuotas.
- **Pagos extraordinarios:** se imputan a capital sin comisiones por cancelación anticipada.
- **Magnitudes:** la exactitud de centavos en tablas y gráficos se garantiza hasta unos $ 90 billones.
- El tamaño del paquete de gráficos es grande (Recharts); la carga diferida por tema reduce el impacto inicial.

## 13. Estructura de carpetas

```
matematica-financiera/
├── index.html
├── package.json
├── vite.config.ts            Vite + Vitest
├── playwright.config.ts      Pruebas de interfaz (1366×768, 1920×1080 y celular)
├── .github/workflows/
│   └── deploy.yml            Publicación automática en GitHub Pages
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx              Punto de entrada
│   ├── App.tsx               Encabezado, navegación por módulos y temas
│   ├── engine/               Motor financiero (sin React)
│   │   ├── decimal.ts        Precisión, redondeo y tolerancias
│   │   ├── rates.ts          Frecuencias y conversión de tasas
│   │   ├── interest.ts       Interés simple y compuesto
│   │   ├── daycount.ts       Fechas y bases ACT/365, ACT/360, 30/360
│   │   ├── amortization.ts   Cuadros de marcha, cambios y prepagos
│   │   ├── validation.ts     Verificaciones de consistencia
│   │   ├── tvm.ts            VA, VF, VAN, TIR
│   │   ├── deposits.ts       Plazo fijo y renovaciones
│   │   ├── loanCost.ts       Cargos y CFT estimado
│   │   ├── inverse.ts        Cálculos inversos
│   │   └── *.test.ts
│   ├── simulation/           Escenarios y series para gráficos
│   ├── charts/               Gráfico cartesiano genérico y línea de tiempo
│   ├── content/              Explicaciones, fórmulas, desarrollos y ejercicios
│   │   └── ejercicios/       Tipos, catálogo, visualizaciones y guía (pendiente)
│   ├── modules/              Páginas de los seis módulos y registro
│   ├── ui/                   Controles, disposición, formato, tema, tablas
│   ├── export/               CSV y Excel
│   └── styles/global.css     Sistema de diseño
└── tests/e2e/                Pruebas de Playwright
```

## 14. Ampliaciones futuras

- Incorporar la guía de ejercicios de referencia y recrear sus gráficos como visualizaciones interactivas.
- Sistemas con cuotas crecientes, períodos de gracia y préstamos UVA (indexados por inflación).
- Tasas reales e inflación (ecuación de Fisher) y comparación de alternativas en moneda constante.
- Rentas (vencidas, adelantadas, diferidas, perpetuidades) y fondos de amortización.
- Bonos: precio, rendimiento, duración y convexidad.
- TIR modificada (TIRM) y comparación de proyectos de distinta escala.
- Guardar y compartir escenarios del laboratorio mediante enlaces.
- Exportación de gráficos como imagen para materiales de clase.
- Funcionamiento sin conexión (aplicación web instalable).
