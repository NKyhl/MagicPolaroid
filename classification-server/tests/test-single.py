import tensorflow as tf
import numpy as np
import sys, os
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from tensorflow.keras.preprocessing.image import ImageDataGenerator

def predict_image(model, img_path, class_indices):
    # Load and preprocess the image
    img = load_img(img_path, target_size=(224, 224))
    img_array = img_to_array(img) / 255.0  # Normalize to [0, 1]
    img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension

    # Predict
    predictions = model.predict(img_array)
    predicted_class = np.argmax(predictions[0])

    # Map class index to class label
    class_labels = {v: k for k, v in class_indices.items()}
    return class_labels[predicted_class], predictions[0]

if __name__ == "__main__":
    # Path to test images
    test_dir = '/home/ec2-user/training_images'

    # Load trained model
    model = tf.keras.models.load_model("../building_classifier_model.h5")

    # Preprocess test data
    test_datagen = ImageDataGenerator(rescale=1.0/255)

    test_generator = test_datagen.flow_from_directory(
        test_dir,
        target_size=(224, 224),
        batch_size=16,
        class_mode='categorical',
        shuffle=False
    )

    # Evaluate model on the test set
    #test_loss, test_accuracy = model.evaluate(test_generator)
    #print(f"Test Accuracy: {test_accuracy * 100:.2f}%")

    class_indices = test_generator.class_indices
    
    directory = os.fsencode('/home/ec2-user/testing')
    
    for file in os.listdir(directory):
        filename = os.fsdecode(file)
        image_path = f'/home/ec2-user/testing/{filename}'
        predicted_label, confidence_scores = predict_image(model, image_path, class_indices)
        print()
        print(f"Filename: {filename}")
        print(f"Predicted Label: {predicted_label}")
        print(f"Confidence Scores: {confidence_scores}")
