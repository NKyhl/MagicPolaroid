import { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
} from "react-native";

export default function Polaroid({ title, defaultText, image, animationStart, onCancel }) {
	const fadeIn = useRef(new Animated.Value(0)).current; // Starting value for fading in image
  const fadeOut = useRef(new Animated.Value(1)).current; // Starting value for fading out default square

  useEffect(() => {
    if (animationStart) {
      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeOut, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [animationStart, fadeIn, fadeOut]);

  return (
    <View style={[styles.polaroid, styles.shadow]}>
      {image && (
        <TouchableOpacity style={styles.closeButton} onPress={() => {onCancel(); fadeIn.setValue(0); fadeOut.setValue(1);}}>
          <Text style={styles.closeButtonText}>X</Text>
        </TouchableOpacity>
      )}
      {image ? (
				// Crossfade between the black square and real image (developing the photo)
				<>
					<Animated.View 
						style={[
							styles.polaroidImageDark,
							{ opacity: fadeOut }
						]}
					/>
					<Animated.Image
						source={{ uri: image }}
						style={[
							styles.polaroidImage,
							{ opacity: fadeIn }
						]}
					/>
					{/* <Image source={{ uri: image }} style={styles.polaroidImage} /> */}
				</>
      ) : (
        <View style={styles.polaroidImageDefault} />
      )}
      <View style={styles.polaroidTextContainer}>
        {image && (
          <>
          {/* Label fades default text out and new label in as photo crossfades */}
          <Animated.Text style={[styles.polaroidText, { opacity: fadeOut }]}>
            {defaultText}
          </Animated.Text>
          <Animated.Text style={[styles.polaroidText, { opacity: fadeIn }]}>
            {title}
          </Animated.Text>
          </>
        )}
        <Text style={styles.polaroidText}>{image && title}</Text>
      </View>
    </View>
  );
}

const styles = {
  polaroid: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 2,
    margin: 20,
    alignItems: "center",
    width: 300,
    height: 340,
  },
  polaroidImageDefault: {
		position: "absolute",
		top: 20,
    width: 260,
    height: 260,
    borderRadius: 2,
    backgroundColor: "darkgrey",
  },
	polaroidImageDark: {
		position: "absolute",
		top: 20,
    width: 260,
    height: 260,
    borderRadius: 2,
    backgroundColor: "black",
  },
  polaroidImage: {
		top: 20,
		position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 2,
  },
  polaroidTextContainer: {
		position: "absolute",
    justifyContent: "center",
    alignItems: "center",
		top: 280,
    marginTop: 10,
    height: 40,
    width: "100%",
    borderRadius: 2,
  },
  polaroidText: {
    position: "absolute",
    fontFamily: "PermanentMarker-Regular",
    textAlign: "center",
    fontSize: 24,
  },
  shadow: {
    shadowColor: "#171717",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  closeButton: {
    position: "absolute",
    right: -15,
    top: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "red",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  closeButtonText: {
    color: "white",
    fontFamily: "PermanentMarker-Regular",
    fontSize: 18,
    lineHeight: 24,
  },
};
