// src/components/DraggableLetterTile.jsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

export default function DraggableLetterTile({
  letter,
  points,
  index,
  disabled,
  onDragStart,
  onDragEnd,
  onDropped,
  boardLayout,
  boardRef,
}) {
  // Pozisyon değerleri
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Animasyonlu stil
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: isDragging.value ? 1.1 : 1 },
      ],
      zIndex: isDragging.value ? 100 : 1,
      opacity: isDragging.value ? 0.8 : 1,
    };
  });

  // Gesture handler
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
      isDragging.value = true;
      if (onDragStart) {
        runOnJS(onDragStart)(index);
      }
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.startX + event.translationX;
      translateY.value = ctx.startY + event.translationY;
    },
    onEnd: (event, ctx) => {
      // Sürükleme bittiğinde raf konumuna geri dön veya tahtaya yerleştir
      if (onDropped && boardLayout && boardRef) {
        // Tahta koordinatlarını hesapla
        runOnJS(calculateBoardPosition)(
          event.absoluteX,
          event.absoluteY,
          translateX,
          translateY
        );
      } else {
        // Orijinal konuma geri dön
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        isDragging.value = false;
        if (onDragEnd) {
          runOnJS(onDragEnd)(index);
        }
      }
    },
  });

  // Tahta üzerindeki konumu hesapla
  const calculateBoardPosition = (
    absoluteX,
    absoluteY,
    translateX,
    translateY
  ) => {
    if (!boardRef || !boardRef.current || !boardLayout) {
      // Tahta referansı veya layout yoksa orijinal konuma dön
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      isDragging.value = false;
      if (onDragEnd) {
        onDragEnd(index);
      }
      return;
    }

    // Tahta koordinat sistemine dönüştür
    boardRef.current.measure((fx, fy, width, height, px, py) => {
      const boardX = absoluteX - px;
      const boardY = absoluteY - py;

      // Hücre boyutu (15x15 bir tahtada)
      const cellSize = width / 15;

      // Hangi hücreye denk geldiğini hesapla
      const col = Math.floor(boardX / cellSize);
      const row = Math.floor(boardY / cellSize);

      // Tahta sınırları içinde mi?
      if (row >= 0 && row < 15 && col >= 0 && col < 15) {
        // Geçerli bir hücre, başarılı bir bırakma işlemi
        if (onDropped) {
          onDropped(index, row, col);
        }
      }

      // Her durumda orijinal konuma geri dön
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      isDragging.value = false;
      if (onDragEnd) {
        onDragEnd(index);
      }
    });
  };

  return (
    <PanGestureHandler enabled={!disabled} onGestureEvent={gestureHandler}>
      <Animated.View style={[styles.tile, animatedStyle]}>
        <Text style={styles.letter}>{letter === "JOKER" ? "*" : letter}</Text>
        {points !== null && <Text style={styles.points}>{points}</Text>}
      </Animated.View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 40,
    height: 40,
    backgroundColor: "#FFF8DC", // Cream color
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    margin: 3,
    borderWidth: 1,
    borderColor: "#DEB887", // Dark cream
    elevation: 2,
  },
  letter: {
    fontSize: 18,
    fontWeight: "bold",
  },
  points: {
    fontSize: 10,
    position: "absolute",
    bottom: 2,
    right: 2,
  },
});
