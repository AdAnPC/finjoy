# FinJoy — Control de Crédito Móvil

App móvil de control de financiamiento de dispositivos. Bloquea el teléfono del usuario si se atrasa en el pago de su cuota mensual, similar a PayJoy / Device Lock Controller.

## Run & Operate

- `pnpm --filter @workspace/device-lock run dev` — Expo dev server (móvil)
- `pnpm --filter @workspace/api-server run dev` — API server (puerto 8080)
- `pnpm run typecheck` — typecheck completo

## Stack

- **Frontend móvil:** Expo SDK 54, Expo Router, React Native
- **Estado:** React Context + AsyncStorage (sin backend en primera versión)
- **UI:** Inter font, expo-blur, expo-haptics, @expo/vector-icons
- **Tabs:** NativeTabs (iOS 26+ liquid glass) + Tabs clásico (fallback)
- **Backend:** Express 5 + TypeScript (preparado para futuras integraciones)

## Estructura de la App

```
artifacts/device-lock/
├── app/
│   ├── _layout.tsx          # Root layout: LoanProvider + LockScreen + PaymentModal
│   └── (tabs)/
│       ├── _layout.tsx      # 3 tabs: Inicio / Pagos / Cuenta
│       ├── index.tsx        # Dashboard: estado del crédito, countdown, progreso
│       ├── payments.tsx     # Historial de pagos
│       └── account.tsx      # Cuenta + controles de demo
├── components/
│   ├── LockScreen.tsx       # Overlay de bloqueo (Modal full-screen)
│   └── PaymentModal.tsx     # Modal de pago (bottom sheet)
├── context/
│   └── LoanContext.tsx      # Estado global del préstamo (AsyncStorage)
└── constants/
    └── colors.ts            # Paleta dark fintech (teal #00C896, red #FF3B30)
```

## Flujo de Bloqueo

1. `LoanContext` calcula el estado (`active` | `due_soon` | `overdue` | `locked` | `completed`)
2. Si `status === 'overdue' || 'locked'` → `isDeviceLocked = true`
3. `RootLayoutNav` en `_layout.tsx` renderiza `<LockScreen visible={isDeviceLocked} />`
4. El LockScreen es un Modal full-screen que cubre toda la app
5. El usuario toca "Pagar Ahora" → abre `PaymentModal`
6. Al confirmar el pago → `makePay()` actualiza el estado → bloqueo se libera

## Demo

En la pestaña **Cuenta**, sección "Modo Demo":
- **Al día** — vencimiento en 15 días
- **Próximo** — vence en 2 días
- **Vencido** — 5 días de atraso (activa la pantalla de bloqueo)
- **Bloqueado** — bloqueo manual (activa la pantalla de bloqueo)
- **Restablecer** — vuelve al estado inicial

## Datos Demo Iniciales

- Cliente: Carlos García
- Dispositivo: Samsung Galaxy A54
- Crédito: $15,000 MXN a 12 meses ($1,250/mes)
- Estado inicial: 4 meses pagados, vence en 3 días

## Architecture decisions

- **Frontend-only en primera versión**: AsyncStorage para persistencia local, sin llamadas al API server. Permite iterar rápido sin configurar base de datos.
- **LockScreen como Modal root-level**: Renderizado en `_layout.tsx` (fuera del tab navigator) para garantizar que cubre absolutamente todo el contenido de la app.
- **PaymentModal en contexto**: `isPaymentModalOpen` vive en `LoanContext` para que tanto el `LockScreen` como los tabs puedan abrirlo sin prop drilling.
- **Paleta dark fija**: Ambos temas (light/dark) usan tonos dark/navy para mantener la estética seria de fintech financiero.

## User preferences

_Construyendo una app tipo PayJoy para mercado hispanohablante._

## Gotchas

- Al cambiar estado de `locked`/`overdue` a `active`, el LockScreen desaparece automáticamente (React re-render).
- `computeStatus()` en el contexto recalcula el estado real al abrir la app (por si cambió la fecha mientras estaba cerrada).
- Las fechas de las cuotas iniciales se calculan dinámicamente con `addDays()` para que siempre sean relativas a hoy.
