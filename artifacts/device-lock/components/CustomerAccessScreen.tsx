import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLoan } from "@/context/LoanContext";

type Props = {
  syncError?: string;
  onRetry?: () => Promise<void>;
  onLogout?: () => Promise<void>;
};

export function CustomerAccessScreen({ syncError, onRetry, onLogout }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, activate, apiConfigured } = useLoan();
  const [mode, setMode] = useState<"login" | "activate">("login");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    if (!apiConfigured) {
      setError("La app no tiene configurada la dirección del servidor de FinJoy.");
      return;
    }
    if (mode === "activate" && password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (mode === "login") await login(phone.trim(), password);
      else await activate(code.trim(), password);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo validar el acceso. Revisa los datos e inténtalo de nuevo.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (syncError) {
    return (
      <View
        style={[
          styles.syncPage,
          { backgroundColor: colors.background, paddingTop: insets.top + 30 },
        ]}
      >
        <View style={[styles.syncCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="cloud-offline-outline" size={38} color={colors.warning} />
          <Text style={[styles.title, { color: colors.foreground }]}>No se pudo sincronizar</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{syncError}</Text>
          <Pressable
            accessibilityRole="button"
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => void onRetry?.()}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              Reintentar
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void onLogout?.()}>
            <Text style={[styles.secondaryButtonText, { color: colors.mutedForeground }]}>
              Cerrar sesión
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.brandMark, { backgroundColor: `${colors.primary}20` }]}>
          <Ionicons name="shield-checkmark" size={30} color={colors.primary} />
        </View>
        <Text style={[styles.brand, { color: colors.foreground }]}>FinJoy</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {mode === "login" ? "Consulta tu crédito" : "Activa tu cuenta"}
        </Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          {mode === "login"
            ? "Inicia sesión con el teléfono registrado y tu contraseña."
            : "Pide tu código de activación a FinJoy. Es de un solo uso y vence en 24 horas."}
        </Text>

        {!apiConfigured && (
          <View style={[styles.notice, { borderColor: colors.warning }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
            <Text style={[styles.noticeText, { color: colors.foreground }]}>
              Configura EXPO_PUBLIC_API_URL en el archivo .env y vuelve a generar el APK.
            </Text>
          </View>
        )}

        {mode === "login" ? (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.foreground }]}>Teléfono</Text>
            <TextInput
              accessibilityLabel="Teléfono"
              value={phone}
              onChangeText={setPhone}
              placeholder="Número registrado en FinJoy"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoCapitalize="none"
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.foreground }]}>Código de activación</Text>
            <TextInput
              accessibilityLabel="Código de activación"
              value={code}
              onChangeText={(value) => setCode(value.toUpperCase())}
              placeholder="Código entregado por FinJoy"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            />
          </View>
        )}

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.foreground }]}>Contraseña</Text>
          <TextInput
            accessibilityLabel="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder={mode === "activate" ? "Al menos 10 caracteres" : "Tu contraseña"}
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
        </View>

        {mode === "activate" && (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.foreground }]}>Confirma la contraseña</Text>
            <TextInput
              accessibilityLabel="Confirma la contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Escribe la contraseña otra vez"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            />
          </View>
        )}

        {error && (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
            {error}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={!apiConfigured || isSubmitting}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: !apiConfigured || isSubmitting ? 0.6 : 1 },
          ]}
          onPress={() => void submit()}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              {mode === "login" ? "Iniciar sesión" : "Activar cuenta"}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={styles.switchButton}
          onPress={() => {
            setMode(mode === "login" ? "activate" : "login");
            setError(null);
          }}
        >
          <Text style={[styles.switchText, { color: colors.primary }]}>
            {mode === "login" ? "Tengo un código de activación" : "Ya tengo una cuenta"}
          </Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28 },
  brandMark: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 18,
    height: 66,
    justifyContent: "center",
    marginBottom: 15,
    width: 66,
  },
  brand: { alignSelf: "center", fontFamily: "Inter_700Bold", fontSize: 22, marginBottom: 26 },
  title: { fontFamily: "Inter_700Bold", fontSize: 25, marginBottom: 8, textAlign: "center" },
  description: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginBottom: 26, textAlign: "center" },
  form: { marginBottom: 16 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 7 },
  input: { borderRadius: 12, borderWidth: 1, fontFamily: "Inter_400Regular", fontSize: 15, minHeight: 50, paddingHorizontal: 14 },
  notice: { alignItems: "flex-start", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 9, marginBottom: 18, padding: 12 },
  noticeText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  error: { fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 19, marginBottom: 13 },
  primaryButton: { alignItems: "center", borderRadius: 12, justifyContent: "center", minHeight: 50, marginTop: 5 },
  primaryButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  switchButton: { alignItems: "center", paddingVertical: 18 },
  switchText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  syncPage: { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 30 },
  syncCard: { alignItems: "center", borderRadius: 18, borderWidth: 1, padding: 24 },
  secondaryButton: { alignItems: "center", paddingVertical: 16 },
  secondaryButtonText: { fontFamily: "Inter_500Medium", fontSize: 14 },
});
