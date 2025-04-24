import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { useColorScheme as useReactNativeColorScheme } from "react-native";

export function useColorScheme() {
  const { colorScheme: nwColorScheme, setColorScheme } = useNativeWindColorScheme();
  const systemColorScheme = useReactNativeColorScheme();

  // Return the full object with additional properties
  return {
    colorScheme: nwColorScheme || systemColorScheme || "light",
    setColorScheme,
    systemColorScheme
  };
}
