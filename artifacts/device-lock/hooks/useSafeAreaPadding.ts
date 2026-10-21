import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useSafeAreaPadding() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  return { insets, topPad, bottomPad };
}
