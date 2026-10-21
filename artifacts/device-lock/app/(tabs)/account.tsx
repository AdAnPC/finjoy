import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaPadding } from '@/hooks/useSafeAreaPadding';
import { useLoan } from '@/context/LoanContext';
import { formatCurrency, formatLongDate, getInitials } from '@/lib/formatters';

export default function AccountScreen() {
  const colors = useColors();
  const { topPad, bottomPad } = useSafeAreaPadding();
  const { loan } = useLoan();

  if (!loan) return null;

  const initials = getInitials(loan.clientName);
  const remaining = loan.totalAmount - loan.paidAmount;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 24, paddingBottom: bottomPad + 110 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile */}
      <View style={styles.profileSection}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.initials, { color: colors.primaryForeground }]}>{initials}</Text>
        </View>
        <Text style={[styles.clientName, { color: colors.foreground }]}>{loan.clientName}</Text>
        <View style={[styles.deviceChip, { backgroundColor: colors.muted }]}>
          <MaterialCommunityIcons name="cellphone" size={14} color={colors.mutedForeground} />
          <Text style={[styles.deviceChipText, { color: colors.mutedForeground }]}>
            {loan.deviceModel}
          </Text>
        </View>
      </View>

      {/* Loan details */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Detalles del Crédito</Text>
        {[
          { label: 'Total del crédito', value: formatCurrency(loan.totalAmount) },
          { label: 'Monto pagado', value: formatCurrency(loan.paidAmount) },
          { label: 'Saldo restante', value: formatCurrency(remaining) },
          { label: 'Cuota mensual', value: formatCurrency(loan.monthlyPayment) },
          { label: 'Meses completados', value: `${loan.paidMonths} de ${loan.totalMonths}` },
          { label: 'Fecha de inicio', value: formatLongDate(loan.startDate) },
        ].map((row, i, arr) => (
          <View key={row.label}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                {row.label}
              </Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>{row.value}</Text>
            </View>
            {i < arr.length - 1 && (
              <View style={[styles.rowSep, { backgroundColor: colors.border }]} />
            )}
          </View>
        ))}
      </View>

      {/* Policy */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Política de Bloqueo</Text>
        {[
          {
            icon: 'time-outline' as const,
            text: `Período de gracia: ${loan.gracePeriodDays} días después del vencimiento`,
          },
          {
            icon: 'lock-closed-outline' as const,
            text: 'El dispositivo se bloquea automáticamente al vencer el período de gracia',
          },
          {
            icon: 'lock-open-outline' as const,
            text: 'El bloqueo se libera de inmediato al confirmar el pago',
          },
          {
            icon: 'call-outline' as const,
            text: 'Soporte disponible 24/7 en caso de emergencia',
          },
        ].map((item, i) => (
          <View key={i} style={styles.policyRow}>
            <View style={[styles.policyIconBox, { backgroundColor: 'rgba(0,200,150,0.12)' }]}>
              <Ionicons name={item.icon} size={16} color={colors.primary} />
            </View>
            <Text style={[styles.policyText, { color: colors.mutedForeground }]}>{item.text}</Text>
          </View>
        ))}
      </View>

      {/* App info */}
      <View style={styles.appInfo}>
        <MaterialCommunityIcons name="shield-lock" size={16} color={colors.mutedForeground} />
        <Text style={[styles.appInfoText, { color: colors.mutedForeground }]}>FinJoy v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },

  profileSection: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  initials: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  clientName: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  deviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  deviceChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  card: { borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 16 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
  },
  detailLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  detailValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowSep: { height: 1 },

  policyRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  policyIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  policyText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },

  appInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  appInfoText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
