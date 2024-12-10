import { useState, useEffect, useRef } from "react";
import {
  Button,
  View,
  Modal,
  StyleSheet,
  Appearance,
  SafeAreaView,
  Text,
  Animated,
  PanResponder,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator } from "expo-image-manipulator";
import Polaroid from "./components/Polaroid";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import DropDownPicker from "react-native-dropdown-picker";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [image, setImage] = useState(null); // The image URI
  const imageRef = useRef(image); // Keep a reference to the image state for use in Polaroid dragging functions.
  const [label, setLabel] = useState(""); // The label for the image
  const [modalVisible, setModalVisible] = useState(false);
  const firstDrag = useRef(false); // Turns true at the start of each drag gesture
  const [animationStart, setAnimationStart] = useState(false); // Triggers beginning of polaroid cross-fade/develop animation
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [correctLabel, setCorrectLabel] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(false);

  const buildingLabels = [
    { label: "Basilica", value: "basilica" },
    { label: "Bond", value: "bond" },
    { label: "Debart", value: "debart" },
    { label: "Dillon", value: "dillon" },
    { label: "Duncan", value: "duncan" },
    { label: "Graham", value: "graham" },
    { label: "Grotto", value: "grotto" },
    { label: "Hes", value: "hes" },
    { label: "Lafun", value: "lafun" },
    { label: "Log", value: "log" },
    { label: "Main Building", value: "mainbuilding" },
    { label: "NDH", value: "ndh" },
    { label: "SDH", value: "sdh" },
  ];

  // Keep image Ref up to date with image State.
  useEffect(() => {
    imageRef.current = image;
  }, [image]);
  
  // Submit the image to the server for classification
  const classifyImage = async (image) => {
    const serverUrl = "http://52.91.173.94:8080/classify";

    try {
      const formData = new FormData();
      formData.append("image", {
        uri: image,
        type: "image/jpeg",
        name: "image.jpg",
      });

      const response = await fetch(serverUrl, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      
      const result = await response.json();
      if (response.ok) {
        setTimeout(() => setVerifyVisible(true), 500); // Delay the prompt slightly for smoother UX
        setLabel(result.label);
      } else {
        console.log(`Failure. Server responded with status ${response.status}`);
      }
    } catch (error) {
      console.error("Error submitting image and label:", error);
    }
  };
  
  // Submit the image-label pair to the server as training data
  const submitImage = async (finalLabel) => {
    const serverUrl = "http://52.91.173.94:8080/submit";

    try {
      const formData = new FormData();
      formData.append("label", finalLabel);
      formData.append("image", {
        uri: image,
        type: "image/jpeg",
        name: "image.jpg",
      });

      const response = await fetch(serverUrl, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.ok) {
        setImage(null);
        setLabel("");
        firstDrag.current = false;
        setAnimationStart(false);
      } else {
        console.log(`Failure. Server responded with status ${response.status}`);
      }
    } catch (error) {
      console.error("Error submitting image and label:", error);
    }
  };
  
  // PanResponder for drag / click gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: async () => {
        // Open the modal if no image is present
        if (!imageRef.current) {
          setModalVisible(true);
          
        // Classify the image if present and the first drag
        } else if (!firstDrag.current) {
          classifyImage(imageRef.current);
          firstDrag.current = true;
          setAnimationStart(true);
        }
      },
      onPanResponderMove: (e, gestureState) => {
        // Update the position as the user drags if the image is present
        if (imageRef.current) {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        }
      },
      onPanResponderRelease: () => {
        // Glide back to the center when released
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          stiffness: 200,
          damping: 10,
        }).start();
      },
    })
  ).current;

  // Load the PermanentMarker font
  const [fontsLoaded, fontsError] = useFonts({
    PermanentMarker: require("./assets/fonts/PermanentMarker-Regular.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontsError]);

  if (!fontsLoaded && !fontsError) {
    return null;
  }

  // Force application light mode
  Appearance.setColorScheme("light");

  // Open the Image Library to select a photo
  const openImageLibrary = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      print('image set');
      const resizedImage = await resizeImage(result.assets[0].uri);
      setImage(resizedImage);
      setModalVisible(false);
    } else {
      console.error("Image Library cancelled");
    }
  };

  // Open the camera to take a new photo
  const openCamera = async () => {
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0,
    });

    if (!result.canceled) {
      const resizedImage = await resizeImage(result.assets[0].uri);
      setImage(resizedImage);
      setModalVisible(false);
      print('image set');
    } else {
      console.error("Camera cancelled");
    }
  };

  // Resize the image to 224x224
  const resizeImage = async (uri) => {
    const ManipulatorContext = ImageManipulator.manipulate(uri);
    ManipulatorContext.resize({ width: 224, height: 224 });
    const manipResult = await (
      await ManipulatorContext.renderAsync()
    ).saveAsync();

    return manipResult.uri;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.polaroidContainer}>
        <Animated.View
          {...panResponder.panHandlers}
          style={{ transform: pan.getTranslateTransform() }}
        >
          <Polaroid
            title={label || "Drag to Reveal"}
            image={image || null}
            animationStart={animationStart}
            onCancel={() => {
              setImage(null);
              setLabel("");
              firstDrag.current = false;
              setAnimationStart(false);
              setVerifyVisible(false);
            }}
          />
        </Animated.View>
      </View>

      {/* Verification Modal */}
      {verifyVisible && (
        <View style={styles.promptContainer}>
          <Text style={styles.promptText}>Predicted Label: {label}</Text>
          <Text>Is this correct?</Text>
          <Button
            title="Yes"
            onPress={() => {
              submitImage(label);
              setVerifyVisible(false);
            }}
          />
          <Button
            title="No"
            onPress={() => {
              setDropdownVisible(true);
              setVerifyVisible(false);
            }}
          />
        </View>
      )}

      {/* Dropdown for Correct Label */}
      {dropdownVisible && (
        <View style={styles.dropdownWrapper}>
          <DropDownPicker
            open={openDropdown}
            value={correctLabel}
            items={buildingLabels}
            setOpen={setOpenDropdown}
            setValue={setCorrectLabel}
            placeholder="Select Correct Label"
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
          />
          <Button
            title="Submit Correct Label"
            onPress={() => {
              if (correctLabel) {
                submitImage(correctLabel);
                setDropdownVisible(false);
              } else {
                console.error("Please select a label");
              }
            }}
          />
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Button title="Take a New Photo" onPress={openCamera} />
            <Button title="Select from Library" onPress={openImageLibrary} />
            <Button
              title="Close"
              onPress={() => {
                setModalVisible(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  polaroidContainer: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 50,
  },
  promptContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginHorizontal: 20,
    marginVertical: 10,
  },
  dropdownWrapper: {
    marginTop: 20,
    justifyContent: "center",
    alignItems: "center",
    width: "90%",
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 15,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  promptText: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: "center",
  },
});

