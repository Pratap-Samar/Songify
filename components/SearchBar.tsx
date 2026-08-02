import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { theme } from "@/constants/theme";

type SearchBarProps = {
  form: string;
  handleChange: (e: string) => void;
  handleClearSearch: () => void;
};

export default function SearchBar(props: SearchBarProps) {
  const { form, handleChange, handleClearSearch } = props;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[style.formContainer, isFocused && style.formContainerFocused]}>
      <Feather name="search" size={20} color={isFocused ? theme.colors.button : theme.colors.subtext} />
      <TextInput
        value={form}
        onChangeText={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        returnKeyType="search"
        style={style.input}
        placeholder="Search for songs"
        placeholderTextColor={theme.colors.subtext}
      />
      {form.length > 0 && (
        <TouchableOpacity onPress={handleClearSearch}>
          <Feather name="x" size={20} color={theme.colors.subtext} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const style = StyleSheet.create({
  formContainer: {
    margin: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: 15,
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "transparent",
    // iOS Shadow
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    // Android Shadow
    elevation: 3,
  },
  formContainerFocused: {
    borderColor: theme.colors.button,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 10,
  },
});
