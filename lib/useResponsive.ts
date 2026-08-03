import { useWindowDimensions } from "react-native";

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLargePhone = width >= 400;

  return {
    isTablet,
    isLargePhone,
    width,
    // Provide a max-width style for centered single-column content
    contentMaxWidth: 800,
    // Column counts for grids (e.g. albums, playlists)
    columns: isTablet ? 4 : isLargePhone ? 3 : 2,
    // Scaled spacing
    spacing: isTablet ? 24 : 16,
    // Scaled font sizes
    titleSize: isTablet ? 28 : 22,
    baseSize: isTablet ? 18 : 15,
  };
}
