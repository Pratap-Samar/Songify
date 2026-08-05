import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View, Text } from "react-native";
import { theme } from "@/constants/theme";

type SearchBarProps = {
  form: string;
  handleChange: (e: string) => void;
  handleClearSearch: () => void;
  autoFocus?: boolean;
  onBack?: () => void;
};

export default function SearchBar(props: SearchBarProps) {
  const { form, handleChange, handleClearSearch, autoFocus, onBack } = props;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={style.wrapper}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={style.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
      )}
      <View style={[style.formContainer, isFocused && style.formContainerFocused]}>
        <Feather name="search" size={20} color={isFocused ? theme.colors.accent.primary : theme.colors.text.secondary} />
        <TextInput
          value={form}
          onChangeText={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoFocus={autoFocus}
          returnKeyType="search"
          style={style.input}
          placeholder="Search for songs"
          placeholderTextColor={theme.colors.text.secondary}
        />
        {form.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch}>
            <Feather name="x" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const style = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  formContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bg.surface,
    borderRadius: 15,
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "transparent",
    // iOS Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    // Android Shadow
    elevation: 3,
  },
  formContainerFocused: {
    borderColor: theme.colors.accent.primary,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text.primary,
    marginLeft: 10,
  },
  backBtn: {
    marginRight: 12,
  },
});
