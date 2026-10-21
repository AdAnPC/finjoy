import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PaidStatusPill } from '@/components/PaidStatusPill';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaPadding } from '@/hooks/useSafeAreaPadding';
import { useLoan, Payment } from '@/context/LoanContext';
import {
  formatCurrency,
  formatShortDate,
  PAYMENT_METHOD_META,
} from '@/lib/formatters';

function PaymentRow({ item }: { item: Payment }) {
  const colors = useColors();
  const meta = PAYMENT_METHOD_META[item.method];
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.methodBubble, { backgroundColor: 'rgba(0,200,150,0.12)' }]}>
        <Ionicons name={meta.outlineIcon} size={18} color={colors.primary} />
      </View>
      <View style={styles.rowMeta}>
        <Text style={[styles.rowRef, { color: colors.foreground }]}>{item.reference}</Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
          {formatShortDate(item.date)} · {meta.label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, { color: colors.foreground }]}>
          {formatCurrency(item.amount)}
        </Text>
        <PaidStatusPill />
      </View>
    </View>
  );
}

export default function PaymentsScreen() {
  const colors = useColors();
  const { topPad, bottomPad } = useSafeAreaPadding();
  const { loan, payments, openPaymentModal } = useLoan();

  const canPay = loan && loan.status !== 'completed';
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 24,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Pagos</Text>
        {canPay && (
          <TouchableOpacity
            style={[styles.newPayBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              openPaymentModal();
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color={colors.primaryForeground} />
            <Text style={[styles.newPayText, { color: colors.primaryForeground }]}>Pagar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary strip */}
      <View
        style={[
          styles.summary,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        {[
          { value: String(payments.length), label: 'Pagos realizados' },
          { value: formatCurrency(totalPaid), label: 'Total pagado' },
          { value: `${loan?.paidMonths ?? 0}/${loan?.totalMonths ?? 0}`, label: 'Meses' },
        ].map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <View style={[styles.summaryDiv, { backgroundColor: colors.border }]} />}
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: colors.foreground }]}>{s.value}</Text>
              <Text style={[styles.summaryLbl, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <FlatList
        data={payments}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PaymentRow item={item} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad + 110 },
        ]}
        scrollEnabled={payments.length > 0}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={52} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sin pagos</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Aún no has realizado ningún pago
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  newPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  newPayText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  summary: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 3 },
  summaryLbl: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  summaryDiv: { width: 1, marginVertical: 4 },

  list: { paddingHorizontal: 20, paddingTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  methodBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowMeta: { flex: 1 },
  rowRef: { fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 3 },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  rowRight: { alignItems: 'flex-end', gap: 5 },
  rowAmount: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  paidPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  paidLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#30D158' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
