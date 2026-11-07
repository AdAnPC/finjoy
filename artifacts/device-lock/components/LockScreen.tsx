import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { setKioskLockEnabled } from 'expo-device-admin';
import { useLoan, PaymentMethod } from '@/context/LoanContext';
import { useSafeAreaPadding } from '@/hooks/useSafeAreaPadding';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  visible: boolean;
}

type GatewayTab = 'wallet' | 'pse' | 'card' | 'cash';

const PSE_BANKS = [
  'Bancolombia',
  'Davivienda',
  'Banco de Bogotá',
  'BBVA Colombia',
  'Nequi',
  'Daviplata',
];

export function LockScreen({ visible }: Props) {
  const { topPad, bottomPad } = useSafeAreaPadding();
  const { loan, daysUntilDue, makePay, refreshAccount } = useLoan();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.25)).current;

  const [gatewayTab, setGatewayTab] = useState<GatewayTab>('wallet');
  const [walletBrand, setWalletBrand] = useState<'Nequi' | 'Daviplata'>('Nequi');
  const [walletPhone, setWalletPhone] = useState('');
  const [selectedBank, setSelectedBank] = useState(PSE_BANKS[0]);
  const [documentId, setDocumentId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  const [isPaying, setIsPaying] = useState(false);
  const [payStepText, setPayStepText] = useState('Procesando pago seguro…');
  const [paySuccess, setPaySuccess] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    void setKioskLockEnabled(visible);
    if (!visible) {
      setIsPaying(false);
      setPaySuccess(false);
      setPayError(null);
      return;
    }

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
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
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      ]),
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.7, duration: 1100, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.2, duration: 1100, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    glowLoop.start();
    return () => {
      pulseLoop.stop();
      glowLoop.stop();
    };
  }, [visible, fadeIn, pulse, glow]);

  if (!visible) return null;

  const isLocked = loan?.status === 'locked';
  const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;
  const alertColor = '#FF3B30';
  const amount = loan?.monthlyPayment && loan.monthlyPayment > 0 ? loan.monthlyPayment : 50;

  const mapTabToMethod = (tab: GatewayTab): PaymentMethod => {
    if (tab === 'card') return 'card';
    if (tab === 'cash') return 'cash';
    return 'transfer';
  };

  const handleProcessGatewayPayment = async () => {
    if (isPaying || paySuccess) return;
    setPayError(null);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsPaying(true);
    setPayStepText(
      gatewayTab === 'wallet'
        ? `Conectando con ${walletBrand}…`
        : gatewayTab === 'pse'
          ? `Conectando con PSE (${selectedBank})…`
          : gatewayTab === 'card'
            ? 'Verificando tarjeta con el banco emisor…'
            : 'Validando recaudo en línea…',
    );

    try {
      await new Promise<void>((r) => setTimeout(r, 900));
      setPayStepText('Aprobando transacción y liberando dispositivo…');
      await makePay(amount, mapTabToMethod(gatewayTab));
      setIsPaying(false);
      setPaySuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise<void>((r) => setTimeout(r, 1200));
      await refreshAccount();
    } catch (err) {
      setIsPaying(false);
      setPayError(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar el pago. Verifica tu conexión a internet.',
      );
    }
  };

  const handleCheckPayment = () => {
    Haptics.selectionAsync();
    void refreshAccount();
  };

  return (
    <View style={styles.overlayRoot}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Animated.View
          style={[
            styles.container,
            { opacity: fadeIn, paddingTop: topPad + 12, paddingBottom: bottomPad + 12 },
          ]}
        >
          <ScrollView
            style={{ width: '100%' }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Brand + Status Header */}
            <View style={styles.brandHeader}>
              <MaterialCommunityIcons name="shield-lock" size={18} color="#00C896" />
              <Text style={styles.brandName}>FinJoy · Control de Crédito</Text>
            </View>

            {/* Compact Lock Alert Banner */}
            <View style={styles.lockHeroBox}>
              <View style={styles.iconSection}>
                <Animated.View
                  style={[styles.glowRing, { opacity: glow, backgroundColor: alertColor }]}
                />
                <Animated.View
                  style={[
                    styles.iconRing,
                    { transform: [{ scale: pulse }], borderColor: alertColor },
                  ]}
                >
                  <Ionicons name="lock-closed" size={32} color={alertColor} />
                </Animated.View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.mainTitle}>DISPOSITIVO BLOQUEADO</Text>
                <Text style={styles.subtitle}>
                  {isLocked
                    ? 'Equipo bloqueado por mora. Realiza tu pago abajo para desbloquearlo al instante.'
                    : daysOverdue === 0
                      ? 'Hoy vence tu cuota. Paga en línea para desbloquear tu celular.'
                      : `Tienes ${daysOverdue} ${daysOverdue === 1 ? 'día' : 'días'} de atraso.`}
                </Text>
              </View>
            </View>

            {/* Summary Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View>
                  <Text style={styles.infoLabel}>Equipo financiado</Text>
                  <Text style={styles.infoValue}>{loan?.deviceModel ?? 'Smartphone FinJoy'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.infoLabel}>Cuota para desbloqueo</Text>
                  <Text style={styles.amountBig}>{formatCurrency(amount)}</Text>
                </View>
              </View>
            </View>

            {/* PASARELA DE PAGO FINJOY PAY */}
            <View style={styles.gatewayContainer}>
              <View style={styles.gatewayHeaderRow}>
                <View style={styles.gatewayTitleWrap}>
                  <Ionicons name="shield-checkmark" size={16} color="#00C896" />
                  <Text style={styles.gatewayTitle}>PASARELA DE PAGO FINJOY PAY</Text>
                </View>
                <View style={styles.sslBadge}>
                  <Ionicons name="lock-closed" size={11} color="#00C896" />
                  <Text style={styles.sslBadgeText}>SSL 256-bit</Text>
                </View>
              </View>

              {paySuccess ? (
                <View style={styles.successBox}>
                  <View style={styles.successIconCircle}>
                    <Ionicons name="checkmark-circle" size={54} color="#30D158" />
                  </View>
                  <Text style={styles.successTitle}>¡Pago Aprobado!</Text>
                  <Text style={styles.successSubtitle}>
                    Tu pago de {formatCurrency(amount)} fue procesado. Desbloqueando tu teléfono…
                  </Text>
                </View>
              ) : (
                <>
                  {/* Method Selector Tabs */}
                  <View style={styles.tabsRow}>
                    {[
                      {
                        key: 'wallet' as const,
                        label: 'Nequi / Davi',
                        icon: 'phone-portrait-outline' as const,
                      },
                      {
                        key: 'pse' as const,
                        label: 'PSE Bancos',
                        icon: 'business-outline' as const,
                      },
                      {
                        key: 'card' as const,
                        label: 'Tarjeta',
                        icon: 'card-outline' as const,
                      },
                      {
                        key: 'cash' as const,
                        label: 'Efecty',
                        icon: 'cash-outline' as const,
                      },
                    ].map((t) => {
                      const active = gatewayTab === t.key;
                      return (
                        <TouchableOpacity
                          key={t.key}
                          style={[styles.tabBtn, active && styles.tabBtnActive]}
                          onPress={() => {
                            setGatewayTab(t.key);
                            setPayError(null);
                            Haptics.selectionAsync();
                          }}
                          disabled={isPaying}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={t.icon}
                            size={18}
                            color={active ? '#00C896' : '#8896BA'}
                          />
                          <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Tab 1: Nequi / Daviplata */}
                  {gatewayTab === 'wallet' && (
                    <View style={styles.formSection}>
                      <View style={styles.walletBrandRow}>
                        {(['Nequi', 'Daviplata'] as const).map((brand) => {
                          const selected = walletBrand === brand;
                          return (
                            <TouchableOpacity
                              key={brand}
                              style={[
                                styles.walletBrandChip,
                                selected && styles.walletBrandChipActive,
                              ]}
                              onPress={() => setWalletBrand(brand)}
                              disabled={isPaying}
                            >
                              <Ionicons
                                name={selected ? 'radio-button-on' : 'radio-button-off'}
                                size={15}
                                color={selected ? '#00C896' : '#8896BA'}
                              />
                              <Text
                                style={[
                                  styles.walletBrandText,
                                  selected && { color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
                                ]}
                              >
                                {brand}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <Text style={styles.inputLabel}>Número de celular {walletBrand}</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: 301 206 6592"
                        placeholderTextColor="#5A6A8A"
                        keyboardType="phone-pad"
                        value={walletPhone}
                        onChangeText={setWalletPhone}
                        editable={!isPaying}
                        maxLength={15}
                      />
                      <Text style={styles.helperNote}>
                        Se debitará {formatCurrency(amount)} de tu cuenta {walletBrand} y el equipo
                        se desbloqueará automáticamente.
                      </Text>
                    </View>
                  )}

                  {/* Tab 2: PSE */}
                  {gatewayTab === 'pse' && (
                    <View style={styles.formSection}>
                      <Text style={styles.inputLabel}>Selecciona tu Banco PSE</Text>
                      <View style={styles.bankGrid}>
                        {PSE_BANKS.map((bank) => {
                          const active = selectedBank === bank;
                          return (
                            <TouchableOpacity
                              key={bank}
                              style={[styles.bankChip, active && styles.bankChipActive]}
                              onPress={() => setSelectedBank(bank)}
                              disabled={isPaying}
                            >
                              <Text
                                style={[
                                  styles.bankChipText,
                                  active && { color: '#00C896', fontFamily: 'Inter_600SemiBold' },
                                ]}
                                numberOfLines={1}
                              >
                                {bank}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={styles.inputLabel}>Documento / Cédula del titular</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Número de identificación"
                        placeholderTextColor="#5A6A8A"
                        keyboardType="number-pad"
                        value={documentId}
                        onChangeText={setDocumentId}
                        editable={!isPaying}
                      />
                    </View>
                  )}

                  {/* Tab 3: Tarjeta */}
                  {gatewayTab === 'card' && (
                    <View style={styles.formSection}>
                      <Text style={styles.inputLabel}>Número de Tarjeta (Débito o Crédito)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="4532 •••• •••• ••••"
                        placeholderTextColor="#5A6A8A"
                        keyboardType="number-pad"
                        value={cardNumber}
                        onChangeText={setCardNumber}
                        editable={!isPaying}
                        maxLength={19}
                      />
                      <View style={styles.cardSplitRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>Vencimiento</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="MM/AA"
                            placeholderTextColor="#5A6A8A"
                            keyboardType="numbers-and-punctuation"
                            value={cardExpiry}
                            onChangeText={setCardExpiry}
                            editable={!isPaying}
                            maxLength={5}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>CVV</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="123"
                            placeholderTextColor="#5A6A8A"
                            keyboardType="number-pad"
                            secureTextEntry
                            value={cardCvv}
                            onChangeText={setCardCvv}
                            editable={!isPaying}
                            maxLength={4}
                          />
                        </View>
                      </View>
                      <Text style={styles.inputLabel}>Nombre en la tarjeta</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Como aparece en la tarjeta"
                        placeholderTextColor="#5A6A8A"
                        value={cardHolder}
                        onChangeText={setCardHolder}
                        editable={!isPaying}
                      />
                    </View>
                  )}

                  {/* Tab 4: Efectivo */}
                  {gatewayTab === 'cash' && (
                    <View style={styles.formSection}>
                      <View style={styles.cashVoucherBox}>
                        <View style={styles.cashRow}>
                          <Text style={styles.cashLabel}>Convenio Efecty / Corresponsal</Text>
                          <Text style={styles.cashVal}>110492 (FinJoy)</Text>
                        </View>
                        <View style={styles.cashRow}>
                          <Text style={styles.cashLabel}>Referencia de Desbloqueo</Text>
                          <Text style={styles.cashVal}>FJ-{loan?.id ?? 1}0048</Text>
                        </View>
                        <View style={styles.cashRow}>
                          <Text style={styles.cashLabel}>Valor exacto</Text>
                          <Text style={[styles.cashVal, { color: '#00C896' }]}>
                            {formatCurrency(amount)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.helperNote}>
                        Si ya realizaste el pago o deseas reportarlo en línea, presiona el botón de
                        abajo para aplicarlo y desbloquear tu celular.
                      </Text>
                    </View>
                  )}

                  {payError && (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                      <Text style={styles.errorText}>{payError}</Text>
                    </View>
                  )}

                  {/* Submit Payment Button */}
                  <TouchableOpacity
                    style={[styles.payBtn, isPaying && { opacity: 0.8 }]}
                    onPress={handleProcessGatewayPayment}
                    activeOpacity={0.85}
                    disabled={isPaying}
                  >
                    {isPaying ? (
                      <View style={styles.payingRow}>
                        <ActivityIndicator color="#070C1A" size="small" />
                        <Text style={styles.payBtnText}>{payStepText}</Text>
                      </View>
                    ) : (
                      <>
                        <Ionicons name="lock-open" size={20} color="#070C1A" />
                        <Text style={styles.payBtnText}>
                          PAGAR {formatCurrency(amount)} Y DESBLOQUEAR
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Manual sync check */}
            <TouchableOpacity
              style={styles.supportBtn}
              onPress={handleCheckPayment}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={16} color="#8896BA" />
              <Text style={styles.supportText}>
                Ya pagué con el administrador · Verificar desbloqueo
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070C1A',
    zIndex: 99999,
    elevation: 99999,
  },
  container: {
    flex: 1,
    backgroundColor: '#070C1A',
    paddingHorizontal: 18,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  brandName: {
    color: '#00C896',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  lockHeroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.32)',
    borderRadius: 18,
    padding: 14,
    gap: 14,
    marginBottom: 12,
  },
  iconSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 68,
  },
  glowRing: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    backgroundColor: 'rgba(255,59,48,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  subtitle: {
    color: '#B0BED9',
    fontSize: 12.5,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#0F1630',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2D50',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: '#8896BA',
    fontSize: 11.5,
    fontFamily: 'Inter_400Regular',
    marginBottom: 2,
  },
  infoValue: {
    color: '#F0F4FF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  amountBig: {
    fontSize: 22,
    color: '#00C896',
    fontFamily: 'Inter_700Bold',
  },
  gatewayContainer: {
    width: '100%',
    backgroundColor: '#0D1428',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#1E355E',
    marginBottom: 14,
  },
  gatewayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  gatewayTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gatewayTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
  },
  sslBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,200,150,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sslBadgeText: {
    color: '#00C896',
    fontSize: 10.5,
    fontFamily: 'Inter_600SemiBold',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: '#131D38',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2D50',
    gap: 4,
  },
  tabBtnActive: {
    borderColor: '#00C896',
    backgroundColor: 'rgba(0,200,150,0.12)',
  },
  tabBtnText: {
    color: '#8896BA',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  tabBtnTextActive: {
    color: '#00C896',
    fontFamily: 'Inter_700Bold',
  },
  formSection: {
    marginBottom: 14,
  },
  walletBrandRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  walletBrandChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#131D38',
    borderWidth: 1,
    borderColor: '#1E2D50',
  },
  walletBrandChipActive: {
    borderColor: '#00C896',
    backgroundColor: 'rgba(0,200,150,0.14)',
  },
  walletBrandText: {
    color: '#8896BA',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  inputLabel: {
    color: '#B0BED9',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#131D38',
    borderWidth: 1,
    borderColor: '#253761',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginBottom: 10,
  },
  helperNote: {
    color: '#7E90B8',
    fontSize: 11.5,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
  bankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  bankChip: {
    width: '48%',
    backgroundColor: '#131D38',
    borderWidth: 1,
    borderColor: '#1E2D50',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  bankChipActive: {
    borderColor: '#00C896',
    backgroundColor: 'rgba(0,200,150,0.12)',
  },
  bankChipText: {
    color: '#B0BED9',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  cardSplitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cashVoucherBox: {
    backgroundColor: '#131D38',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#253761',
    marginBottom: 10,
    gap: 8,
  },
  cashRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cashLabel: {
    color: '#8896BA',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  cashVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,59,48,0.14)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  payBtn: {
    width: '100%',
    backgroundColor: '#00C896',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  payingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payBtnText: {
    color: '#070C1A',
    fontSize: 14.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  successIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(48,209,88,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    color: '#30D158',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  successSubtitle: {
    color: '#B0BED9',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 19,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
  },
  supportText: {
    color: '#8896BA',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
