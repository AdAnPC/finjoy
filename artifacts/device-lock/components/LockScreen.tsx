import React, { useEffect, useRef } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { lockDeviceNow, setKioskLockEnabled } from 'expo-device-admin';
import { PaymentModal } from '@/components/PaymentModal';
import { useLoan } from '@/context/LoanContext';
import { useSafeAreaPadding } from '@/hooks/useSafeAreaPadding';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  visible: boolean;
}

export function LockScreen({ visible }: Props) {
  const { topPad, bottomPad } = useSafeAreaPadding();
  const { loan, daysUntilDue, openPaymentModal, refreshAccount } = useLoan();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    void setKioskLockEnabled(visible);
    if (!visible) return;

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        void setKioskLockEnabled(true);
        void lockDeviceNow();
      } else if (state === 'active') {
        void setKioskLockEnabled(true);
        void refreshAccount();
      }
    });

    return () => {
      backSubscription.remove();
      appStateSubscription.remove();
    };
  }, [visible, refreshAccount]);

  useEffect(() => {
    if (!visible) {
      fadeIn.setValue(0);
      return;
    }
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.13, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.75, duration: 1100, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.2, duration: 1100, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();
    glowLoop.start();
    return () => {
      pulseLoop.stop();
      glowLoop.stop();
    };
  }, [visible]);

  const isLocked = loan?.status === 'locked';
  const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;
  const alertColor = '#FF3B30';

  const handlePayNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    openPaymentModal();
  };

  const handleCheckPayment = () => {
    Haptics.selectionAsync();
    void refreshAccount();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={() => {}}
    >
      <Animated.View
        style={[
          styles.container,
          { opacity: fadeIn, paddingTop: topPad, paddingBottom: bottomPad },
        ]}
      >
        {/* Brand header */}
        <View style={[styles.brandHeader, { top: topPad + 20 }]}>
          <MaterialCommunityIcons name="shield-lock" size={18} color="#00C896" />
          <Text style={styles.brandName}>FinJoy</Text>
        </View>

        {/* Lock icon with glow */}
        <View style={styles.iconSection}>
          <Animated.View style={[styles.glowRing, { opacity: glow, backgroundColor: alertColor }]} />
          <Animated.View style={[styles.iconRing, { transform: [{ scale: pulse }], borderColor: alertColor }]}>
            <Ionicons name="lock-closed" size={54} color={alertColor} />
          </Animated.View>
        </View>

        {/* Status text */}
        <Text style={styles.mainTitle}>DISPOSITIVO BLOQUEADO</Text>
        <Text style={styles.subtitle}>
          {isLocked
            ? 'Tu teléfono está totalmente bloqueado por falta de pago'
            : daysOverdue === 0
              ? 'Hoy es tu día de pago. Realiza tu pago para desbloquear el teléfono'
              : `Tu pago lleva ${daysOverdue} ${daysOverdue === 1 ? 'día' : 'días'} de atraso`}
        </Text>

        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dispositivo</Text>
            <Text style={styles.infoValue}>{loan?.deviceModel ?? '—'}</Text>
          </View>
          <View style={styles.infoSep} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cuota pendiente</Text>
            <Text style={[styles.infoValue, styles.amountBig]}>
              {formatCurrency(loan?.monthlyPayment ?? 0)}
            </Text>
          </View>
          {daysOverdue > 0 && (
            <>
              <View style={styles.infoSep} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Días de atraso</Text>
                <Text style={[styles.infoValue, { color: alertColor }]}>
                  {daysOverdue} {daysOverdue === 1 ? 'día' : 'días'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.payBtn} onPress={handlePayNow} activeOpacity={0.85}>
          <Ionicons name="card" size={20} color="#070C1A" />
          <Text style={styles.payBtnText}>PAGAR AHORA PARA DESBLOQUEAR</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.supportBtn} onPress={handleCheckPayment} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={16} color="#5A6A8A" />
          <Text style={styles.supportText}>Ya pagué · Verificar desbloqueo</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          El teléfono permanecerá bloqueado hasta que se confirme tu pago
        </Text>
        <PaymentModal />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070C1A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  brandHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  brandName: {
    color: '#00C896',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  iconSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    width: 160,
    height: 160,
  },
  glowRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  iconRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2.5,
    backgroundColor: 'rgba(255,59,48,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#8896BA',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#0F1630',
    borderRadius: 18,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#1E2D50',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    color: '#8896BA',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  infoValue: {
    color: '#F0F4FF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  amountBig: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  infoSep: {
    height: 1,
    backgroundColor: '#1E2D50',
  },
  payBtn: {
    width: '100%',
    backgroundColor: '#00C896',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  payBtnText: {
    color: '#070C1A',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    marginBottom: 20,
  },
  supportText: {
    color: '#5A6A8A',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  footerNote: {
    color: '#2A3A5A',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
