import React from "react";
import { StyleSheet, View } from "react-native";
const { getHexagramLines } = require("./hexagrams");

const YANG = "#8B1E1E";
const YIN = "#1A1A1A";

/**
 * Compact six-yao icon for Zhouyi hexagram chapters.
 * Yang = solid bar; yin = two segments with a center gap.
 */
export default function HexagramIcon({ chapter, size = 34, style }) {
  const lines = getHexagramLines(chapter);
  if (!lines) return null;

  const barHeight = Math.max(3, Math.round(size * 0.11));
  const gap = Math.max(2, Math.round(size * 0.07));
  const height = barHeight * 6 + gap * 5;

  return (
    <View
      accessible
      accessibilityLabel={`${chapter}卦象`}
      style={[styles.wrap, { width: size, height }, style]}
    >
      {lines.map((line, index) =>
        line === "yang" ? (
          <View
            key={index}
            style={[styles.yang, { height: barHeight, backgroundColor: YANG }]}
          />
        ) : (
          <View key={index} style={[styles.yinRow, { height: barHeight }]}>
            <View style={[styles.yinSeg, { height: barHeight, backgroundColor: YIN }]} />
            <View style={[styles.yinSeg, { height: barHeight, backgroundColor: YIN }]} />
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: "space-between",
    flexShrink: 0
  },
  yang: {
    width: "100%",
    borderRadius: 1
  },
  yinRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  yinSeg: {
    width: "40%",
    borderRadius: 1
  }
});
