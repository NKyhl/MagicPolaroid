import { useState, useEffect, useRef } from "react";
import {
  Button,
  TouchableOpacity,
  View,
  Modal,
  StyleSheet,
  Appearance,
  SafeAreaView,
  Text,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator } from "expo-image-manipulator";
import Polaroid from "./components/Polaroid";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import DropDownPicker from "react-native-dropdown-picker";

SplashScreen.preventAutoHideAsync();
const { width, height } = Dimensions.get("window");

// Global variable for serverUrl
let globalServerUrl = null;

export default function App() {
  const [image, setImage] = useState(null); // The image URI
  const imageRef = useRef(image); // Keep a reference to the image state for use in Polaroid dragging functions.
  const [label, setLabel] = useState(""); // The label for the image
  const [modalVisible, setModalVisible] = useState(false);
  const firstDrag = useRef(false); // Turns true at the start of each drag gesture
  const [animationStart, setAnimationStart] = useState(false); // Triggers beginning of polaroid cross-fade/develop animation
  const pickerRef = useRef();
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [correctLabel, setCorrectLabel] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [serverUrl, setServerUrl] = useState(null); // Server URL stored as state

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

  // Fetch server information from catalog
  useEffect(() => {
    const fetchServerInfo = async () => {
      const catalogUrl = "http://catalog.cse.nd.edu:9097/query.json";
      try {
        const response = await fetch(catalogUrl);
        const data = await response.json();

        const serverDetails = data.find(
          (listing) =>
            listing.type === "magic-polaroid" && listing.owner === "mvankir2"
        );

        if (serverDetails) {
          const url = `http://${serverDetails.address}:${serverDetails.port}`;
          setServerUrl(url);
          globalServerUrl = url; // Set global server URL
          console.log("Server URL set to:", url); // Debug log for server URL
        } else {
          console.error("Server details not found in catalog");
        }
      } catch (error) {
        console.error("Error fetching server details:", error);
      }
    };

    fetchServerInfo();
  }, []);

  // Classify image
  const classifyImage = async (image) => {
    const currentServerUrl = globalServerUrl || serverUrl; // Use globalServerUrl as fallback
    console.log("ClassifyImage called with serverUrl:", currentServerUrl); // Debug log for classifyImage
    if (!currentServerUrl) {
      console.error("Server URL not set. Unable to classify image.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("image", {
        uri: image,
        type: "image/jpeg",
        name: "image.jpg",
      });

      const response = await fetch(`${currentServerUrl}/classify`, {
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

  // Keep image Ref up to date with image State.
  useEffect(() => {
    imageRef.current = image;
  }, [image]);

  // PanResponder for drag gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: async () => {
        if (!imageRef.current) {
          setModalVisible(true);
        } else if (!firstDrag.current) {
          classifyImage(imageRef.current);
          firstDrag.current = true;
          setAnimationStart(true);
        }
      },
      onPanResponderMove: (e, gestureState) => {
        if (imageRef.current) {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        }
      },
      onPanResponderRelease: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
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

  // Choose an image from the Image Library
  const openImageLibrary = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const resizedImage = await resizeImage(result.assets[0].uri);
      setImage(resizedImage);
      setModalVisible(false);
    }
  };

  // Open the camera to take a new photo
  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    console.log("Opening camera with status", status);
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    console.log("Camera result:", result);

    if (!result.canceled) {
      const resizedImage = await resizeImage(result.assets[0].uri);
      setImage(resizedImage);
      setModalVisible(false);
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

  // Submit the image-label pair to the server as training data
  const submitImage = async (finalLabel) => {
    const currentServerUrl = globalServerUrl || serverUrl; // Use globalServerUrl as fallback
    if (!currentServerUrl) {
      console.error("Server URL not set. Unable to submit image.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("label", finalLabel);
      formData.append("image", {
        uri: image,
        type: "image/jpeg",
        name: "image.jpg",
      });

      const response = await fetch(`${currentServerUrl}/submit`, {
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
