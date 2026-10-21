import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaPadding } from '@/hooks/useSafeAreaPadding';
import { useLoan, LoanStatus } from '@/context/LoanContext';
import { formatCurrency, formatLongDate, getInitials } from '@/lib/formatters';

interface DemoButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accentColor: string;
  onPress: () => void;
}

function DemoButton({ icon, label, accentColor, onPress }: DemoButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.demoBtn,
        { borderColor: accentColor, backgroundColor: accentColor + '18' },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={16} color={accentColor} />
      <Text style={[styles.demoBtnText, { color: accentColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AccountScreen() {
  const colors = useColors();
  const { topPad, bottomPad } = useSafeAreaPadding();
  const { loan, setLoanStatus, resetDemo } = useLoan();

  if (!loan) return null;

  const initials = getInitials(loan.clientName);
  const remaining = loan.totalAmount - loan.paidAmount;

  const simulate = (status: LoanStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoanStatus(status);
  };

  const handleReset = () => {
    Alert.alert(
      'Restablecer Demo',
      '¿Quieres volver al estado inicial de demostración?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            resetDemo();
          },
        },
      ]
    );
  };

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

      {/* Demo controls */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.demoTitleRow}>
          <Ionicons name="flask-outline" size={16} color={colors.warning} />
          <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 0 }]}>
            Modo Demo
          </Text>
        </View>
        <Text style={[styles.demoSub, { color: colors.mutedForeground }]}>
          Simula diferentes estados para probar la app
        </Text>

        <View style={styles.demoGrid}>
          <DemoButton
            icon="shield-checkmark-outline"
            label="Al día"
            accentColor={colors.primary}
            onPress={() => simulate('active')}
          />
          <DemoButton
            icon="time-outline"
            label="Próximo"
            accentColor={colors.warning}
            onPress={() => simulate('due_soon')}
          />
          <DemoButton
            icon="warning-outline"
            label="Vencido"
            accentColor={colors.danger}
            onPress={() => simulate('overdue')}
          />
          <DemoButton
            icon="lock-closed-outline"
            label="Bloqueado"
            accentColor={colors.danger}
            onPress={() => simulate('locked')}
          />
        </View>

        <TouchableOpacity
          style={[styles.resetBtn, { borderColor: colors.border }]}
          onPress={handleReset}
          activeOpacity={0.75}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.resetText, { color: colors.mutedForeground }]}>
            Restablecer Demo
          </Text>
        </TouchableOpacity>
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

  demoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  demoSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 20 },
  demoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  demoBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
  resetText: { fontSize: 14, fontFamily: 'Inter_500Medium' },

  appInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  appInfoText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
