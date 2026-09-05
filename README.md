<p align="center">
  <img src="docs/assets/lockup.svg" alt="Open Expenses" width="418">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-1a1c1c.svg" alt="License: AGPL-3.0"></a>
  <a href="https://github.com/lautibonet/open-expenses/actions/workflows/deploy.yml"><img src="https://github.com/lautibonet/open-expenses/actions/workflows/deploy.yml/badge.svg" alt="Deploy status"></a>
</p>

**Your money. Your browser. Your ledger.**

Open Expenses is a personal expense tracker that replaces the spreadsheet. It runs entirely in your browser as a PWA, keeps every figure on your device, and offers one optional backup to your own Google Drive. No account, no server, no tracking. Free software under AGPL-3.0.

## Try it

Open **[openexpenses.app](https://openexpenses.app)**. Nothing to install: the hosted app is the production build of this repo, it works offline once loaded, and it updates itself through the service worker with an in-app prompt when a new version is ready.

## Origin

Open Expenses started as a Google Sheets template, refined by hand over ten years of real budgets. Month after month it taught one lesson: a ledger is a discipline, not a database. In 2026 the template became this app: the same ledger, rebuilt to run entirely in your browser.

## Highlights

- **LOCAL-FIRST.** Every figure lives in your browser (IndexedDB). The app works fully offline.
- **NO ACCOUNT. NO SERVER. NO TRACKING.** There is no backend: your data leaves your device only when you back it up.
- **MULTI-CURRENCY.** Accounts in different currencies; exchange rates come from the European Central Bank (via Frankfurter) and can be confirmed or overridden on each movement.
- **TRANSFERS ARE THEIR OWN THING.** Transfers between your own accounts never count as income or expense; the cross-currency ones record the rate they used.
- **STATS WITH INTENT.** Year-to-period totals, monthly averages, savings rate, expenses by category, and per-account balances as of the end of the chosen period.
- **BACKUP TO YOUR OWN DRIVE.** One manual action saves `open-expenses-backup.json` to your Google Drive; restoring it on another device is one step.
- **ENGLISH AND SPANISH.** The whole app, this README included.

## Screenshots

**Movements**, the ledger:

<p align="center">
  <img src="docs/screenshots/movements.png" alt="Movements screen: a ledger of transactions with green income, red expenses, a grey transfer, and a net flow card" width="854">
</p>

**Stats**, the summary:

<p align="center">
  <img src="docs/screenshots/stats.png" alt="Stats screen: income, expenses and net cards, a net by period chart, expenses by category, and per-account balances" width="854">
</p>

## Built with

Angular 21, TypeScript, Dexie over IndexedDB, and self-hosted Inter and JetBrains Mono. Every architectural decision is written down in [docs/adr/](docs/adr/).

**SELF-HOST.** It is a static site: clone the repo, run `npm ci` and `npm run build`, and serve `dist/open-expenses/browser` from any static host. Production runs on Cloudflare Pages; GitHub Pages works as a fallback.

## License

Open Expenses is free software under [AGPL-3.0](LICENSE).

---

<p align="center">
  <img src="docs/assets/lockup.svg" alt="Open Expenses" width="418">
</p>

**Tu dinero. Tu navegador. Tu registro.**

Open Expenses es un controlador de gastos personales que reemplaza la hoja de cálculo. Funciona por completo en tu navegador como PWA, guarda cada cifra en tu dispositivo y ofrece una única copia de seguridad opcional en tu propio Google Drive. Sin cuenta, sin servidor, sin rastreo. Software libre bajo AGPL-3.0.

## Pruébala

Abre **[openexpenses.app](https://openexpenses.app)**. Nada que instalar: la app alojada es la build de producción de este repo, funciona sin conexión una vez cargada y se actualiza sola mediante el service worker, con un aviso dentro de la app cuando hay una versión nueva lista.

## Origen

Open Expenses empezó como una plantilla de Google Sheets, afinada a mano durante diez años de presupuestos reales. Mes a mes enseñó una lección: un registro es una disciplina, no una base de datos. En 2026 la plantilla se convirtió en esta app: el mismo registro, reconstruido para funcionar por completo en tu navegador.

## Lo que ofrece

- **LOCAL-FIRST.** Cada cifra vive en tu navegador (IndexedDB). La app funciona del todo sin conexión.
- **SIN CUENTA. SIN SERVIDOR. SIN RASTREO.** No hay backend: tus datos salen de tu dispositivo solo cuando tú haces una copia.
- **MULTIDIVISA.** Cuentas en distintas monedas; los tipos de cambio vienen del Banco Central Europeo (vía Frankfurter) y puedes confirmarlos o corregirlos en cada movimiento.
- **LAS TRANSFERENCIAS SON OTRA COSA.** Las transferencias entre tus propias cuentas nunca cuentan como ingreso ni gasto, y las de divisa cruzada guardan el tipo de cambio que usaron.
- **ESTADÍSTICAS CON INTENCIÓN.** Totales del año hasta el periodo, promedios mensuales, tasa de ahorro, gastos por categoría y saldos por cuenta al cierre del periodo elegido.
- **COPIA EN TU PROPIO DRIVE.** Una acción manual guarda `open-expenses-backup.json` en tu Google Drive; restaurarla en otro dispositivo es un paso.
- **INGLÉS Y ESPAÑOL.** Toda la app, y este README también.

## Capturas

**Movimientos**, el registro:

<p align="center">
  <img src="docs/screenshots/movements.png" alt="Pantalla de movimientos: un registro de transacciones con ingresos en verde, gastos en rojo, una transferencia en gris y una tarjeta de flujo neto" width="854">
</p>

**Estadísticas**, el resumen:

<p align="center">
  <img src="docs/screenshots/stats.png" alt="Pantalla de estadísticas: tarjetas de ingresos, gastos y neto, un gráfico de neto por periodo, gastos por categoría y saldos por cuenta" width="854">
</p>

## Construida con

Angular 21, TypeScript, Dexie sobre IndexedDB y las tipografías Inter y JetBrains Mono autoalojadas. Cada decisión de arquitectura está escrita en [docs/adr/](docs/adr/).

**AUTOALOJAMIENTO.** Es un sitio estático: clona el repo, ejecuta `npm ci` y `npm run build`, y sirve `dist/open-expenses/browser` en cualquier host estático. La producción corre en Cloudflare Pages; GitHub Pages sirve como alternativa.

## Licencia

Open Expenses es software libre bajo [AGPL-3.0](LICENSE).
