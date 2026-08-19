import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View, Text } from "react-native";
import { theme } from "@/constants/theme";

type SearchBarProps = {
  form: string;
  handleChange: (e: string) => void;
  handleClearSearch: () => void;
  autoFocus?: boolean;
  onBack?: () => void;
  onSubmitEditing?: () => void;
};

export default function SearchBar(props: SearchBarProps) {
  const { form, handleChange, handleClearSearch, autoFocus, onBack, onSubmitEditing } = props;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={style.wrapper}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={style.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
      )}
      <View style={[style.formContainer, isFocused && style.formContainerFocused]}>
        <Ionicons name="search" size={20} color={isFocused ? theme.colors.accent.primary : theme.colors.text.muted} />
        <TextInput
          value={form}
          onChangeText={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoFocus={autoFocus}
          returnKeyType="search"
          onSubmitEditing={onSubmitEditing}
          style={style.input}
          placeholder="Search for songs"
          placeholderTextColor={theme.colors.text.muted}
        />
        {form.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch}>
            <Ionicons name="close" size={20} color={theme.colors.text.muted} />
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
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  formContainerFocused: {
    borderColor: theme.colors.border.strong,
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
