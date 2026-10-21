import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function PaidStatusPill({ label = "Pagado" }: { label?: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(48,209,88,0.12)",
  },
  text: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#30D158",
  },
});
