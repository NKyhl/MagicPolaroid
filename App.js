import { useState } from 'react';
import { Button, Image, Text, View, Modal, StyleSheet, Appearance, SafeAreaView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';

export default function ImagePickerExample() {
  const [image, setImage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  Appearance.setColorScheme('light')

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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

  const openCamera = async () => {
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
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
  }

  const resizeImage = async (uri) => {
    const ManipulatorContext = ImageManipulator.manipulate(uri);
    ManipulatorContext.resize({ width: 224, height: 224 });
    const manipResult = await (await ManipulatorContext.renderAsync()).saveAsync();

    return manipResult.uri;
  }

  const sendImage = async () => {
    const formData = new FormData();
    formData.append('image', image);
    fetch('URL', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
      .then(response => response.json())
      .then(data => {
        console.log(data);
      })
      .catch(error => {
        console.error('Error:', error);
      });
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>ND Building Classifier</Text>
      {image && <Image source={{ uri: image }} style={styles.image} />}
      {image && <Text style={styles.imageCaption}>Make sure the full building is within the photo!</Text>}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Button title="Take a New Photo" onPress={openCamera} />
            <Button title="Select from Library" onPress={pickImage} />
            <Button
              title="Close"
              onPress={() => {
                setModalVisible(false);
              }}
            />
          </View>
        </View>
      </Modal>
      <View style={styles.buttonContainer}>
        <Button
          title={!image ? "Select Photo" : "Change Photo"}
          onPress={() => {
            setModalVisible(true);
          }}
          />
        {image && <Button title="Classify Building" onPress={sendImage} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  image: {
    width: 300,
    height: 300,
    borderRadius: 20,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
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
    backgroundColor: '#F194FF',
  },
  buttonClose: {
    backgroundColor: '#2196F3',
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
  },
  title: {
    position: 'absolute',
    textAlign: 'center',
    width: '100%',
    top: 70,
    padding: 16,
    fontSize: 25,
    fontWeight: 'bold',
  },
  imageCaption: {
    marginTop: 8,
  }
});
