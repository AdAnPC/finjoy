import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLoan, PaymentMethod } from '@/context/LoanContext';

const METHODS: { key: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'transfer', label: 'Transferencia', icon: 'swap-horizontal' },
  { key: 'cash', label: 'Efectivo', icon: 'cash' },
  { key: 'card', label: 'Tarjeta', icon: 'card' },
];

export function PaymentModal() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loan, isPaymentModalOpen, closePaymentModal, makePay } = useLoan();

  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [isPaying, setIsPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const amount = loan?.monthlyPayment ?? 0;
  const bottomPad = insets.bottom + (Platform.OS === 'web' ? 34 : 16);

  // Reset state after modal closes
  useEffect(() => {
    if (!isPaymentModalOpen) {
      const t = setTimeout(() => {
        setIsPaying(false);
        setPaid(false);
        setMethod('transfer');
      }, 350);
      return () => clearTimeout(t);
    }
  }, [isPaymentModalOpen]);

  const handleClose = () => {
    if (isPaying) return;
    closePaymentModal();
  };

  const handlePay = async () => {
    if (isPaying || paid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPaying(true);
    // Simulate network delay
    await new Promise<void>(r => setTimeout(r, 1600));
    await makePay(amount, method);
    setIsPaying(false);
    setPaid(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Auto-close after showing success
    await new Promise<void>(r => setTimeout(r, 2200));
    closePaymentModal();
  };

  return (
    <Modal
      visible={isPaymentModalOpen}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.card, paddingBottom: bottomPad },
            ]}
          >
            {/* Drag handle */}
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Realizar Pago</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={16} disabled={isPaying}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {paid ? (
              /* Success state */
              <View style={styles.successBox}>
                <View style={[styles.successCircle, { backgroundColor: 'rgba(48,209,88,0.14)' }]}>
                  <Ionicons name="checkmark-circle" size={56} color="#30D158" />
                </View>
                <Text style={[styles.successTitle, { color: colors.foreground }]}>¡Pago Exitoso!</Text>
                <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
                  Tu dispositivo será desbloqueado en breve
                </Text>
              </View>
            ) : (
              <>
                {/* Amount display */}
                <View style={[styles.amountCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>
                    MONTO A PAGAR
                  </Text>
                  <Text style={[styles.amountValue, { color: colors.foreground }]}>
                    ${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.amountSub, { color: colors.mutedForeground }]}>
                    Cuota mensual · {loan?.paidMonths != null ? `Mes ${loan.paidMonths + 1} de ${loan.totalMonths}` : '—'}
                  </Text>
                </View>

                {/* Payment method */}
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  MÉTODO DE PAGO
                </Text>
                <View style={styles.methodRow}>
                  {METHODS.map(m => {
                    const active = method === m.key;
                    return (
                      <TouchableOpacity
                        key={m.key}
                        style={[
                          styles.methodBtn,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? 'rgba(0,200,150,0.10)' : colors.muted,
                          },
                        ]}
                        onPress={() => {
                          setMethod(m.key);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={m.icon}
                          size={20}
                          color={active ? colors.primary : colors.mutedForeground}
                        />
                        <Text
                          style={[
                            styles.methodLabel,
                            { color: active ? colors.primary : colors.mutedForeground },
                          ]}
                        >
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Security note */}
                <View style={[styles.secureRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
                  <Text style={[styles.secureText, { color: colors.mutedForeground }]}>
                    Transacción cifrada con SSL · Pago seguro
                  </Text>
                </View>

                {/* Confirm button */}
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    { backgroundColor: colors.primary, opacity: isPaying ? 0.75 : 1 },
                  ]}
                  onPress={handlePay}
                  activeOpacity={0.85}
                  disabled={isPaying}
                >
                  {isPaying ? (
                    <ActivityIndicator color={colors.primaryForeground} size="small" />
                  ) : (
                    <>
                      <Ionicons name="lock-open" size={18} color={colors.primaryForeground} />
                      <Text style={[styles.confirmText, { color: colors.primaryForeground }]}>
                        Confirmar Pago
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  kav: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 22,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 26,
  },
  sheetTitle: {
    fontSize: 19,
    fontFamily: 'Inter_600SemiBold',
  },
  amountCard: {
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    marginBottom: 26,
    borderWidth: 1,
  },
  amountLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  amountValue: {
    fontSize: 38,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  amountSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  methodBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 7,
  },
  methodLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  secureText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  confirmBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 4,
  },
  confirmText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
  },
  successSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
});
