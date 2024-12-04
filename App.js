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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator } from "expo-image-manipulator";
import Polaroid from "./components/Polaroid";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Picker } from "@react-native-picker/picker";

SplashScreen.preventAutoHideAsync()
const { width, height } = Dimensions.get("window");

export default function App() {
  const [image, setImage] = useState(null); // The image URI
  const imageRef = useRef(image); // Keep a reference to the image state for use in Polaroid dragging functions.
  const [label, setLabel] = useState(""); // The label for the image
  const [modalVisible, setModalVisible] = useState(false); 
  const firstDrag = useRef(false); // Turns true at the start of each drag gesture
  const [animationStart, setAnimationStart] = useState(false); // Triggers beginning of polaroid cross-fade/develop animation
  const pickerRef = useRef();
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Classify image
  const classifyImage = async (image) => {
    const serverUrl = "http://98.83.146.174:8080/classify";

    try {
      const formData = new FormData();
      // formData.append('label', label);
      formData.append("image", {
        uri: image,
        type: "image/jpeg",
        name: "image.jpg",
      });

      console.log(formData);

      const response = await fetch(serverUrl, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const result = await response.json();
      if (response.ok) {
        console.log("Success");
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
        // Update the position as the user drags if the image is present
        if (imageRef.current) {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        }
      },
      onPanResponderRelease: () => {
        // Glide back to the center when released
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 }, // Return to center
          useNativeDriver: true, // Optimize performance
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

  // Choose an image from the Image Library
  const openImageLibrary = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    console.log(result);

    if (!result.canceled) {
      const resizedImage = await resizeImage(result.assets[0].uri);
      setImage(resizedImage);
      setModalVisible(false);
      console.log(resizedImage);
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
      console.log(resizedImage);
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
  const submitImage = async () => {
    const serverUrl = process.env.SERVER_URL;

    try {
      const formData = new FormData();
      formData.append("label", label);
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
        console.log("Success");
        setImage(null);
        setLabel("");
      } else {
        console.log(`Failure. Server responded with status ${response.status}`);
      }
    } catch (error) {
      console.error("Error submitting image and label:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centeredView}>
        {
          <Animated.View
            {...panResponder.panHandlers}
            style={{
              zIndex: 1,
              transform: pan.getTranslateTransform(), // Apply the drag transformations
            }}
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
              }}
            />
          </Animated.View>
        }
      </View>
      {/* <Text style={styles.title}>Submit Training Data</Text> */}
      {/* {image && <Text style={styles.imageCaption}>Make sure the full building is within the photo!</Text>} */}
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
            {/* ) : (
              <>
                <Picker
                  ref={pickerRef}
                  style={{ height: 200, width: 270, margin: 0 }}
                  itemStyle={{fontFamily: 'PermanentMarker'}}
                  enabled={false}
                  selectedValue={label}
                  onValueChange={(val, index) => 
                    setLabel(val)
                  }>
                  <Picker.Item label="Label me" value="" />
                  <Picker.Item label="Main Building" value="Main Building" />
                  <Picker.Item label="Basilica" value="Basilica" />
                  <Picker.Item label="Duncan Student Center" value="Duncan Student Center" />
                  <Picker.Item label="LaFortune Student Center" value="LaFortune Student Center" />
                  <Picker.Item label="Log Chapel" value="Log Chapel" />
                  <Picker.Item label="Hesburgh Library" value="Hesburgh Library" />
                  <Picker.Item label="The Grotto" value="The Grotto" />
                  <Picker.Item label="South Dining Hall" value="South Dining Hall" />
                  <Picker.Item label="North Dining Hall" value="North Dining Hall" />
                  <Picker.Item label="Bond Hall" value="Bond Hall" />
                  <Picker.Item label="DeBartolo Hall" value="DeBartolo Hall" />
                  <Picker.Item label="Dillon Hall" value="Dillon Hall" />
                  <Picker.Item label="Graham Family Hall" value="Graham Family Hall" />
                </Picker>
                <Button
                title="Save"
                onPress={() => {
                  setModalVisible(false);
                }}
                />
              </>
            )} */}
          </View>
        </View>
      </Modal>
      {/* {image && <Button title="Classify Building" onPress={sendImage} />} */}
      {/* <View style={styles.buttonContainer}>
        {(image) && <Button title="Classify Image" onPress={classifyImage} />}
      </View> */}
    </SafeAreaView>
  );
}

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#f5f5f5',
//   }
// });
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    backgroundColor: "#ecf0f1",
  },
  image: {
    width: 300,
    height: 300,
    borderRadius: 20,
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
  buttonContainer: {
    marginTop: 40,
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
  },
  buttonOpen: {
    backgroundColor: "#F194FF",
  },
  buttonClose: {
    backgroundColor: "#2196F3",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
  },
  title: {
    position: "absolute",
    textAlign: "center",
    width: "100%",
    top: 70,
    padding: 16,
    fontSize: 25,
    fontWeight: "bold",
  },
  imageCaption: {
    marginTop: 8,
  },
});
