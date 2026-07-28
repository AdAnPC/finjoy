import React from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLoan, LoanStatus } from '@/context/LoanContext';

function formatCurrency(n: number): string {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
};

function statusConfig(status: LoanStatus, days: number) {
  switch (status) {
    case 'locked':
      return { color: '#FF3B30', bg: 'rgba(255,59,48,0.14)', label: 'Bloqueado', icon: 'lock-closed' as const };
    case 'overdue':
      return { color: '#FF9F0A', bg: 'rgba(255,159,10,0.14)', label: 'Vencido', icon: 'warning' as const };
    case 'due_soon':
      return {
        color: '#FF9F0A',
        bg: 'rgba(255,159,10,0.14)',
        label: `Vence en ${days} día${days !== 1 ? 's' : ''}`,
        icon: 'time' as const,
      };
    case 'completed':
      return { color: '#30D158', bg: 'rgba(48,209,88,0.14)', label: 'Liquidado', icon: 'checkmark-circle' as const };
    default:
      return { color: '#00C896', bg: 'rgba(0,200,150,0.14)', label: 'Al día', icon: 'shield-checkmark' as const };
  }
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loan, payments, isLoading, daysUntilDue, progressPercent, openPaymentModal } = useLoan();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (!loan) return null;

  const cfg = statusConfig(loan.status, daysUntilDue);
  const recent = payments.slice(0, 3);
  const remaining = loan.totalAmount - loan.paidAmount;
  const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;
  const showPayBtn = loan.status === 'due_soon' || loan.status === 'overdue' || loan.status === 'locked';

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 24, paddingBottom: bottomPad + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Hola,</Text>
            <Text style={[styles.clientName, { color: colors.foreground }]}>{loan.clientName}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={13} color={cfg.color} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Hero payment card */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.heroTop}>
            <MaterialCommunityIcons name="cellphone" size={16} color={colors.mutedForeground} />
            <Text style={[styles.deviceText, { color: colors.mutedForeground }]}>{loan.deviceModel}</Text>
          </View>

          <View style={styles.heroMiddle}>
            <View>
              <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
                {daysUntilDue < 0 ? 'Vencido hace' : 'Próximo pago en'}
              </Text>
              <View style={styles.daysRow}>
                <Text style={[styles.daysNum, { color: daysUntilDue < 0 ? '#FF3B30' : colors.foreground }]}>
                  {Math.abs(daysUntilDue)}
                </Text>
                <Text style={[styles.daysSuffix, { color: colors.mutedForeground }]}>
                  {Math.abs(daysUntilDue) === 1 ? 'día' : 'días'}
                </Text>
              </View>
            </View>
            <View style={styles.amountRight}>
              <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>Cuota mensual</Text>
              <Text style={[styles.amountValue, { color: colors.foreground }]}>
                {formatCurrency(loan.monthlyPayment)}
              </Text>
            </View>
          </View>

          <View style={[styles.heroBottom, { borderTopColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.dueDateText, { color: colors.mutedForeground }]}>
              Vencimiento: {formatDate(loan.nextDueDate)}
            </Text>
          </View>
        </View>

        {/* Pay CTA */}
        {showPayBtn && (
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              openPaymentModal();
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="card" size={18} color={colors.primaryForeground} />
            <Text style={[styles.payBtnText, { color: colors.primaryForeground }]}>Pagar Ahora</Text>
          </TouchableOpacity>
        )}

        {/* Progress */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Progreso del Crédito</Text>
            <Text style={[styles.cardAccent, { color: colors.primary }]}>
              {Math.round(progressPercent)}%
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.fill,
                { width: `${progressPercent}%` as any, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <View style={styles.trackLabels}>
            <Text style={[styles.trackLabel, { color: colors.mutedForeground }]}>
              Mes {loan.paidMonths} / {loan.totalMonths}
            </Text>
            <Text style={[styles.trackLabel, { color: colors.mutedForeground }]}>
              {formatCurrency(remaining)} restante
            </Text>
          </View>

          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            {[
              { val: formatCurrency(loan.paidAmount), lbl: 'Pagado' },
              { val: formatCurrency(remaining), lbl: 'Pendiente' },
              { val: formatCurrency(loan.totalAmount), lbl: 'Total' },
            ].map((s, i) => (
              <React.Fragment key={s.lbl}>
                {i > 0 && <View style={[styles.statDiv, { backgroundColor: colors.border }]} />}
                <View style={styles.statItem}>
                  <Text style={[styles.statVal, { color: colors.foreground }]}>{s.val}</Text>
                  <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{s.lbl}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Recent payments */}
        {recent.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Pagos Recientes</Text>
            {recent.map((p, i) => (
              <View key={p.id}>
                <View style={styles.payItem}>
                  <View style={[styles.payIcon, { backgroundColor: 'rgba(48,209,88,0.13)' }]}>
                    <Ionicons name="checkmark" size={15} color="#30D158" />
                  </View>
                  <View style={styles.payMeta}>
                    <Text style={[styles.payAmount, { color: colors.foreground }]}>
                      {formatCurrency(p.amount)}
                    </Text>
                    <Text style={[styles.payDate, { color: colors.mutedForeground }]}>
                      {formatDate(p.date)} · {METHOD_LABELS[p.method] ?? p.method}
                    </Text>
                  </View>
                  <View style={[styles.paidPill, { backgroundColor: 'rgba(48,209,88,0.12)' }]}>
                    <Text style={styles.paidText}>Pagado</Text>
                  </View>
                </View>
                {i < recent.length - 1 && (
                  <View style={[styles.sep, { backgroundColor: colors.border, marginLeft: 54 }]} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Lock notice if overdue */}
        {(loan.status === 'overdue' || loan.status === 'locked') && (
          <View style={[styles.lockNotice, { borderColor: '#FF3B30', backgroundColor: 'rgba(255,59,48,0.08)' }]}>
            <Ionicons name="lock-closed" size={18} color="#FF3B30" />
            <Text style={[styles.lockNoticeText, { color: '#FF9F0A' }]}>
              {loan.status === 'locked'
                ? 'El dispositivo está bloqueado. Realiza tu pago para recuperar el acceso.'
                : `Tu pago lleva ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''} de atraso. Paga ahora para evitar el bloqueo.`}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 22,
  },
  greeting: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  clientName: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  heroCard: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  deviceText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  heroMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
  },
  heroSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 5 },
  daysRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  daysNum: { fontSize: 52, fontFamily: 'Inter_700Bold', lineHeight: 58 },
  daysSuffix: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  amountRight: { alignItems: 'flex-end' },
  amountValue: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  dueDateText: { fontSize: 13, fontFamily: 'Inter_400Regular' },

  payBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  payBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },

  card: { borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cardAccent: { fontSize: 15, fontFamily: 'Inter_700Bold' },

  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  fill: { height: 8, borderRadius: 4 },
  trackLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  trackLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  statsRow: { flexDirection: 'row', paddingTop: 16, borderTopWidth: 1 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 3 },
  statLbl: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statDiv: { width: 1, marginVertical: 4 },

  payItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  payIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  payMeta: { flex: 1 },
  payAmount: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  payDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  paidPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  paidText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#30D158' },
  sep: { height: 1 },

  lockNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  lockNoticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
});
