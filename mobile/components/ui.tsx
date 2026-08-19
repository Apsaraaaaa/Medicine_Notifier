import { MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Modal as RNModal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { useTheme } from "../context/AppContext";
import { RADIUS, SIZES, TYPE, type Palette } from "../constants/theme";

export type IconName = ComponentProps<typeof MaterialIcons>["name"];

/** Minimum touch target — every pressable in the app clears this. */
export const TAP = SIZES.tap;

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type TextTone = "ink" | "ink2" | "ink3" | "brandInk" | "okInk" | "warnInk" | "badInk";

export function T({
  children,
  tone = "ink",
  size = TYPE.body,
  weight = "400",
  style,
  numberOfLines,
  center,
}: {
  children: ReactNode;
  tone?: TextTone;
  size?: number;
  weight?: TextStyle["fontWeight"];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  center?: boolean;
}) {
  const c = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { color: c[tone], fontSize: size, fontWeight: weight, lineHeight: Math.round(size * 1.45) },
        center && { textAlign: "center" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";

function buttonColors(c: Palette, variant: BtnVariant) {
  switch (variant) {
    case "secondary":
      return { bg: c.surface, fg: c.ink, border: c.line };
    case "danger":
      return { bg: c.badSolid, fg: c.onBad, border: "transparent" };
    case "ghost":
      return { bg: "transparent", fg: c.brandInk, border: "transparent" };
    default:
      return { bg: c.brandSolid, fg: c.onBrand, border: "transparent" };
  }
}

export function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: BtnVariant;
  size?: "md" | "lg";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { bg, fg, border } = buttonColors(c, variant);
  const off = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: border,
          minHeight: size === "lg" ? SIZES.buttonLg : SIZES.buttonMd,
          opacity: off ? 0.6 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && (
            <MaterialIcons name={icon} size={size === "lg" ? SIZES.iconLg : SIZES.icon} color={fg} />
          )}
          <Text
            style={{
              color: fg,
              fontSize: size === "lg" ? TYPE.bodyLg : TYPE.body,
              fontWeight: "800",
            }}
          >
            {children}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color,
  size = SIZES.iconLg,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  color?: string;
  size?: number;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: pressed ? c.surface2 : "transparent" },
      ]}
    >
      <MaterialIcons name={icon} size={size} color={color ?? c.ink3} />
    </Pressable>
  );
}

export function LinkAction({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.linkAction}>
      <Text style={{ color: c.brandInk, fontWeight: "800", fontSize: TYPE.body }}>{children}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const c = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.line, padding: padded ? 16 : 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <T size={TYPE.title} weight="800">
        {children}
      </T>
      {action}
    </View>
  );
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: c.surface, borderBottomColor: c.line, paddingTop: insets.top + 8 },
      ]}
    >
      {onBack && <IconButton icon="arrow-back" label="Go back" onPress={onBack} color={c.ink} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={TYPE.headline} weight="800" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T size={TYPE.small} tone="ink3" numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const c = useTheme();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: c.brandSoft }]}>
        <MaterialIcons name={icon} size={38} color={c.brandInk} />
      </View>
      <T size={TYPE.title} weight="800" center style={{ marginTop: 14 }}>
        {title}
      </T>
      {subtitle ? (
        <T tone="ink2" center style={{ marginTop: 4 }}>
          {subtitle}
        </T>
      ) : null}
      {action ? <View style={{ marginTop: 16, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chips & badges
// ---------------------------------------------------------------------------

export function StatusBadge({
  icon,
  label,
  bg,
  fg,
}: {
  icon?: IconName;
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon && <MaterialIcons name={icon} size={16} color={fg} />}
      <Text style={{ color: fg, fontSize: TYPE.small, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

export function TimeChip({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={[styles.timeChip, { backgroundColor: c.surface2, borderColor: c.line }]}>
      <MaterialIcons name="schedule" size={16} color={c.ink3} />
      <Text style={{ color: c.ink2, fontSize: TYPE.small, fontWeight: "800" }}>{children}</Text>
    </View>
  );
}

export function FilterChip({
  children,
  selected,
  onPress,
}: {
  children: ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? c.brandSoft : c.surface,
          borderColor: selected ? c.brand : c.line,
        },
      ]}
    >
      <Text
        style={{ color: selected ? c.brandInk : c.ink2, fontWeight: "800", fontSize: TYPE.body }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export function Field({
  label,
  icon,
  error,
  hint,
  right,
  style,
  ...props
}: {
  label: string;
  icon?: IconName;
  error?: string;
  hint?: string;
  right?: ReactNode;
} & TextInputProps) {
  const c = useTheme();
  return (
    <View>
      <T size={TYPE.body} tone="ink2" weight="700" style={{ marginBottom: 8 }}>
        {label}
      </T>
      <View
        style={[
          styles.fieldShell,
          {
            backgroundColor: props.editable === false ? c.surface2 : c.surface,
            borderColor: error ? c.bad : c.line,
          },
        ]}
      >
        {icon && <MaterialIcons name={icon} size={SIZES.icon} color={c.ink3} />}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={c.ink3}
          {...props}
          style={[styles.fieldInput, { color: c.ink }, style]}
        />
        {right}
      </View>
      {error ? (
        <View style={styles.fieldNote}>
          <MaterialIcons name="error-outline" size={18} color={c.badInk} />
          <Text style={{ color: c.badInk, fontSize: TYPE.small, fontWeight: "700" }}>{error}</Text>
        </View>
      ) : hint ? (
        <T size={TYPE.small} tone="ink3" style={{ marginTop: 6 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function TextArea({
  label,
  rows = 3,
  ...props
}: { label: string; rows?: number } & TextInputProps) {
  const c = useTheme();
  return (
    <View>
      <T size={TYPE.body} tone="ink2" weight="700" style={{ marginBottom: 8 }}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        multiline
        textAlignVertical="top"
        placeholderTextColor={c.ink3}
        {...props}
        style={[
          styles.textArea,
          { backgroundColor: c.surface, borderColor: c.line, color: c.ink, minHeight: rows * 26 + 20 },
        ]}
      />
    </View>
  );
}

export function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = useTheme();
  return (
    <Switch
      accessibilityLabel={label}
      value={on}
      onValueChange={onChange}
      trackColor={{ false: c.line, true: c.brand }}
      thumbColor={c.surface}
    />
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const c = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.segmented, { backgroundColor: c.surface2, borderColor: c.line }]}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.key)}
            style={[
              styles.segment,
              active && { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1 },
            ]}
          >
            <Text
              style={{
                color: active ? c.brandInk : c.ink2,
                fontWeight: "800",
                fontSize: TYPE.body,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export function SettingsRow({
  icon,
  label,
  description,
  value,
  control,
  onPress,
}: {
  icon: IconName;
  label: string;
  description?: string;
  value?: string;
  control?: ReactNode;
  onPress?: () => void;
}) {
  const c = useTheme();
  const body = (
    <>
      <View style={[styles.settingsIcon, { backgroundColor: c.brandSoft }]}>
        <MaterialIcons name={icon} size={22} color={c.brandInk} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={TYPE.bodyLg} weight="700">
          {label}
        </T>
        {description ? (
          <T size={TYPE.small} tone="ink3">
            {description}
          </T>
        ) : null}
      </View>
      {value ? (
        <T size={TYPE.body} tone="ink3">
          {value}
        </T>
      ) : null}
      {control}
      {onPress && !control ? (
        <MaterialIcons name="chevron-right" size={26} color={c.ink3} />
      ) : null}
    </>
  );

  if (!onPress) return <View style={styles.settingsRow}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        { backgroundColor: pressed ? c.surface2 : "transparent" },
      ]}
    >
      {body}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

export function Modal({
  title,
  description,
  onClose,
  children,
  tone = "default",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  const c = useTheme();
  return (
    <RNModal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: c.scrim }]}>
        <Pressable
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={[styles.modalCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={styles.modalHead}>
            <View
              style={[
                styles.settingsIcon,
                { backgroundColor: tone === "danger" ? c.badSoft : c.brandSoft },
              ]}
            >
              <MaterialIcons
                name={tone === "danger" ? "warning-amber" : "info-outline"}
                size={18}
                color={tone === "danger" ? c.badInk : c.brandInk}
              />
            </View>
            <T size={TYPE.title} weight="800" style={{ flex: 1 }}>
              {title}
            </T>
          </View>
          {description ? (
            <T tone="ink2" style={{ marginTop: 8 }}>
              {description}
            </T>
          ) : null}
          <View style={{ marginTop: 18 }}>{children}</View>
        </View>
      </View>
    </RNModal>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <RNModal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={[styles.sheetScrim, { backgroundColor: c.scrim }]}>
        <Pressable
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: c.surface,
              borderColor: c.line,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <View style={styles.sheetHead}>
            <T size={TYPE.title} weight="800" style={{ flex: 1 }} numberOfLines={1}>
              {title}
            </T>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>
          <ScrollView style={{ maxHeight: 460 }}>{children}</ScrollView>
        </View>
      </View>
    </RNModal>
  );
}

export function SheetAction({
  icon,
  label,
  onPress,
  tone = "default",
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: "default" | "danger";
}) {
  const c = useTheme();
  const fg = tone === "danger" ? c.badInk : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetAction,
        { backgroundColor: pressed ? c.surface2 : "transparent" },
      ]}
    >
      <View
        style={[
          styles.settingsIcon,
          { backgroundColor: tone === "danger" ? c.badSoft : c.brandSoft },
        ]}
      >
        <MaterialIcons name={icon} size={22} color={fg} />
      </View>
      <Text style={{ color: fg, fontSize: TYPE.bodyLg, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Adherence ring
// ---------------------------------------------------------------------------

export function AdherenceRing({
  value,
  label,
  size = 56,
  stroke = 7,
  color,
  children,
}: {
  /** 0..1, or null when nothing is scheduled. */
  value: number | null;
  label: string;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const c = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value));

  return (
    <View accessible accessibilityLabel={label} style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.line}
          strokeWidth={stroke}
          fill="none"
        />
        {pct > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color ?? c.brand}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - pct)}
            fill="none"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS.btn,
    borderWidth: 1,
    paddingHorizontal: 18,
  },
  iconButton: {
    width: TAP,
    height: TAP,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: TAP / 2,
  },
  linkAction: { minHeight: TAP, justifyContent: "center", paddingHorizontal: 8 },
  card: { borderRadius: RADIUS.card, borderWidth: 1 },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  emptyState: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 12 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterChip: {
    minHeight: TAP,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  fieldShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 2,
    borderRadius: RADIUS.field,
    paddingHorizontal: 16,
    minHeight: SIZES.control,
  },
  fieldInput: { flex: 1, fontSize: TYPE.bodyLg, paddingVertical: 14 },
  fieldNote: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  textArea: {
    borderWidth: 2,
    borderRadius: RADIUS.field,
    padding: 16,
    fontSize: TYPE.bodyLg,
  },
  segmented: { flexDirection: "row", borderRadius: 999, borderWidth: 1, padding: 4, gap: 4 },
  segment: {
    flex: 1,
    minHeight: TAP,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderColor: "transparent",
    borderWidth: 1,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    minHeight: 68,
  },
  settingsIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  scrim: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 420, borderRadius: RADIUS.sheet, borderWidth: 1, padding: 20 },
  modalHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetScrim: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sheetAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 64,
    borderRadius: RADIUS.field,
    paddingHorizontal: 4,
  },
});
