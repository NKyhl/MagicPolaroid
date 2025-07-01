import os
import time
import numpy as np
from flask import Flask, request, jsonify, send_file
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import threading, subprocess, socket, json
import io
import zipfile

PORT_NUM = 8080

def register_with_catalog(name, port):
    # Recall function every 60 seconds
    t = threading.Timer(60.0, register_with_catalog, args=[name, port]).start()

    # Catalog entry
    entry = { "type" : "magic-polaroid",
             "owner" : "mvankir2",
             "port" : port,
             "project" : name
           }

    # Set addr and define UDP socket
    addr = ('catalog.cse.nd.edu', 9097)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        
    # Send UDP packet to name server
    sock.connect(addr)
    sock.sendall(json.dumps(entry).encode())
    sock.close()

# Get IP address
ip = subprocess.run(['dig', 'ANY','+short', '@resolver2.opendns.com', 'myip.opendns.com'], capture_output=True, text=True).stdout.strip()

# Send IP/port to catalog server
register_with_catalog(ip, PORT_NUM)

def find_models():
    models = []
    for file in os.listdir('.'):
        if file.startswith('model_') and file.endswith('.h5'):
            try:
                timestamp = int(file[6:-3])
                models.append((file, timestamp))
            except ValueError:
                continue

    return models

# Find the building classifier model
models = find_models()
newest_model, timestamp = sorted(models, key=lambda model_info: model_info[1])[-1]
MODEL_TIMESTAMP = timestamp

# Remove old models
for model, timestamp in models:
    if timestamp != MODEL_TIMESTAMP and timestamp != 0:
        os.remove(model)

# Load building classifier model
model = load_model(newest_model)

second_timestamp = MODEL_TIMESTAMP / 1e9
time_info = time.gmtime(second_timestamp)
formatted_timestamp = time.strftime("%m-%d-%Y %H:%M:%S", time_info)
print(f'Loaded model from {formatted_timestamp} UTC')

# Create Flask app
app = Flask(__name__)

# Load class indices from test generator
def get_class_indices():
    # for AWS server
    test_dir = 'training_images'
    test_datagen = ImageDataGenerator(rescale=1.0 / 255)
    test_generator = test_datagen.flow_from_directory(
        test_dir,
        target_size=(224, 224),
        batch_size=16,
        class_mode='categorical',
        shuffle=False
    )
    return test_generator.class_indices

class_indices = get_class_indices()
class_labels = {v: k for k, v in class_indices.items()}

# Generate images folder and subfolders to store new data
IMAGE_FOLDER = 'training_images'
for class_label in class_labels.values():
    subfolder = os.path.join(IMAGE_FOLDER, class_label)
    os.makedirs(subfolder, exist_ok=True)

def predict_image(model, img_path):
    """Predict the class of the given image using the loaded model."""
    try:
        # Load/preprocess the image
        img = load_img(img_path, target_size=(224, 224))
        img_array = img_to_array(img) / 255.0  # Normalize to [0, 1]
        img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension

        # Predict
        predictions = model.predict(img_array)
        predicted_class_idx = np.argmax(predictions[0])
        confidence_scores = predictions[0]
        predicted_confidence = float(confidence_scores[predicted_class_idx] * 100)  # Convert to percentage and ensure float

        return class_labels.get(predicted_class_idx, "Unknown"), predicted_confidence

    except Exception as e:
        return str(e), None

@app.route('/', methods=['GET'])
def home():
    return jsonify({'status': 'server is running'})

@app.route('/classify', methods=['POST'])
def classify():
    """Endpoint to classify a building image."""
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    # Save the image temporarily
    image = request.files['image']
    image_filename = f"tmp_{time.time_ns()}.jpg"
    image.save(image_filename)

    # Predict class
    try:
        predicted_label, predicted_confidence = predict_image(model, image_filename)
        print('prediction:', predicted_label)
        return jsonify({
            'label': predicted_label,
            'confidence_percent': predicted_confidence
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        # Remove image
        os.remove(image_filename)

def zip_folder(folder_path):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, start=folder_path)  # Preserve folder structure
                zip_file.write(file_path, arcname)
    zip_buffer.seek(0)
    return zip_buffer

@app.route('/submit', methods=['POST'])
def submit():
    """Save given image and label to directory for future model training."""
    if 'image' not in request.files or 'label' not in request.form:
        return jsonify({'error': 'Request must contain image and label'}), 400

    image = request.files['image']
    label = request.form['label']

    # Validate label
    if not label:
        return jsonify({'error': 'Label is required'}), 400
    if label not in class_labels.values():
        return jsonify({'error': 'Class does not exist'}), 400

    # Save image in appropriate folder
    save_dir = os.path.join(IMAGE_FOLDER, label)
    os.makedirs(save_dir, exist_ok=True)

    timestamp = str(time.time_ns()).replace('.', '')
    image_filename = os.path.join(save_dir, f"{timestamp}.jpg")
    image.save(image_filename)

    return jsonify({
        'message': 'Image added to training data'
    }), 200

@app.route('/training-data-check', methods=['GET'])
def training_data_check():
    if not os.path.exists(IMAGE_FOLDER):
        return jsonify({"new-image-count": 0})

    # Count how many images have been received 
    image_count = 0
    for class_label in class_labels.values():
        subfolder = os.path.join(IMAGE_FOLDER, class_label)
        for entry in os.listdir(subfolder):
            if os.path.isfile(os.path.join(subfolder, entry)) and entry.endswith('.jpg'):
                timestamp = entry.rsplit('.jpg', 1)[0]
                if timestamp.isdigit() and int(timestamp) > MODEL_TIMESTAMP:
                    image_count += 1

    return jsonify({'new-image-count': image_count}), 200

@app.route('/training-data', methods=['GET'])
def training_data():
    if not os.path.exists(IMAGE_FOLDER):
        return jsonify({"error": 0})

    # Zip the training data
    zip_data = zip_folder(IMAGE_FOLDER)
    return send_file(
        zip_data,
        mimetype='application/zip',
    ), 200

@app.route('/update-model', methods=['POST'])
def update_model():
    if 'model' not in request.files:
        return jsonify({"error": "please include the new model"}), 400

    new_model = request.files['model']
    filename = new_model.filename

    print(f'New model received with name {filename}')

    global model
    global MODEL_TIMESTAMP

    if not new_model or filename == '' or filename.rsplit('.', 1)[1].lower() != 'h5':
        return jsonify({"error": "invalid model"}), 400
    if 'model_' not in filename or not filename[6:-3].isdigit() or int(filename[6:-3]) < MODEL_TIMESTAMP:
        return jsonify({"error": "outdated model"}), 400

    output_path = os.path.join(".", filename)
    new_model.save(output_path)

    old_timestamp = MODEL_TIMESTAMP
    model = load_model(output_path)
    MODEL_TIMESTAMP = int(filename[6:-3])
    if old_timestamp != 0:
        os.remove(os.path.join(".", f"model_{old_timestamp}.h5"))

    return jsonify({"message": "model updated succesfully"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT_NUM, threaded=True)
