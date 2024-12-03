import { View, Image, Text, TouchableOpacity } from 'react-native';

export default function Polaroid({ title, image, onCancel}) {
    return (
        <View style={[styles.polaroid, styles.shadow]}>
            {image && (
                <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
                    <Text style={styles.closeButtonText}>X</Text>
                </TouchableOpacity>
            )}
            {image ? (
                <Image source={{ uri: image }} style={styles.polaroidImage}/>
            ) : (
                <View style={styles.polaroidImageDefault}/>
            )}
            <View style={styles.polaroidTextContainer}>
                <Text style={styles.polaroidText}>{image && title}</Text>
            </View>
        </View>
    );
}

const styles = {
    polaroid: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 2,
        margin: 20,
        alignItems: 'center',
        width: 300,
        height: 340,
    },
    polaroidImageDefault: {
        width: 260,
        height: 260,
        borderRadius: 2,
        backgroundColor: 'darkgrey',
    },
    polaroidImage: {
        width: 260,
        height: 260,
        borderRadius: 2,
    },
    polaroidTextContainer: {
        marginTop: 10,
        height: 40,
        width: '100%',
        borderRadius: 2,
    },
    polaroidText: {
        fontFamily: 'PermanentMarker-Regular',
        textAlign: 'center',
        fontSize: 24,
    },
    shadow: {
        shadowColor: '#171717',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    closeButton: {
        position: 'absolute',
        right: -15,
        top: -15,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'red',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    closeButtonText: {
        color: 'white',
        fontFamily: 'PermanentMarker-Regular',
        fontSize: 18,
        lineHeight: 24,
    }
};