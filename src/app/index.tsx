import { Camera, CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import jsQR from "jsqr";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function App() {
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(
    null,
  );
  const [mediaPermission, setMediaPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const [scannedTableNumber, setScannedTableNumber] = useState<string | null>(
    null,
  );
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    const requestPermissions = async () => {
      if (isWeb) {
        setCameraPermission(true);
        setMediaPermission(true);
        return;
      }

      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(cameraStatus.status === "granted");

      const mediaStatus =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      setMediaPermission(mediaStatus.status === "granted");
    };

    requestPermissions();
  }, []);

  // Process QR result
  const processQrData = (url: string) => {
    setScanned(true);
    setScannedUrl(url);

    // Extract tableNumber or token from URL
    let extractedTableNumber: string | null = null;
    try {
      const parsedUrl = new URL(url);
      // Table Number သို့မဟုတ် Token ပါလျှင် ယူမည်
      extractedTableNumber =
        parsedUrl.searchParams.get("tableNumber") ||
        parsedUrl.searchParams.get("token");
    } catch (e) {
      // URL format မဟုတ်ပါက raw string အဖြစ် ယူမည်
      extractedTableNumber = url;
    }

    setScannedTableNumber(extractedTableNumber);

    const displayTitle = extractedTableNumber
      ? `Table: ${extractedTableNumber}`
      : "QR Code Detected!";

    if (isWeb) {
      const confirmOpen = window.confirm(
        `${displayTitle}\n\nFound Link:\n${url}\n\nDo you want to open this menu?`,
      );
      if (confirmOpen) {
        window.open(url, "_blank");
      }
      return;
    }

    Alert.alert(displayTitle, `Found Menu Link:\n${url}`, [
      {
        text: "Open Menu",
        onPress: async () => {
          try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
              await Linking.openURL(url);
            } else {
              Alert.alert("Error", "Could not open this URL.");
            }
          } catch (error) {
            console.error(error);
            Alert.alert("Error", "Could not open this URL.");
          }
        },
      },
      {
        text: "Scan Again",
        style: "cancel",
        onPress: () => {
          setScanned(false);
          setScannedUrl(null);
          setScannedTableNumber(null);
        },
      },
    ]);
  };

  const handleBarcodeScanned = ({ data }: { data: string; type: string }) => {
    if (scanned) return;
    processQrData(data);
  };

  // Pick QR image from gallery
  const pickImageAndScanQR = async () => {
    if (isWeb) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];

        if (!file) return;

        const imageUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            alert("Could not process the image.");
            URL.revokeObjectURL(imageUrl);
            return;
          }

          // Scale down image for fast and reliable jsQR parsing
          const maxDimension = 800;
          let width = image.width;
          let height = image.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          context.drawImage(image, 0, 0, width, height);
          const imageData = context.getImageData(0, 0, width, height);

          const qrCode = jsQR(
            imageData.data,
            imageData.width,
            imageData.height,
            {
              inversionAttempts: "dontInvert",
            },
          );

          URL.revokeObjectURL(imageUrl);

          if (qrCode && qrCode.data) {
            processQrData(qrCode.data);
          } else {
            alert("No readable QR code found in the selected image.");
          }
        };

        image.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          alert("Could not load the selected image file.");
        };

        image.src = imageUrl;
      };

      input.click();
      return;
    }

    if (!mediaPermission) {
      Alert.alert("Permission Required", "Please allow photo library access.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;

      const imageUri = result.assets[0].uri;
      const qrResults = await Camera.scanFromURLAsync(imageUri, ["qr"]);

      if (qrResults.length > 0) {
        processQrData(qrResults[0].data);
      } else {
        Alert.alert(
          "No QR Code Found",
          "The selected image does not contain a readable QR code.",
        );
      }
    } catch (error) {
      console.error("QR image scanning error:", error);
      Alert.alert("Error", "Something went wrong while scanning the image.");
    }
  };

  if (cameraPermission === null || mediaPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>Preparing QR scanner...</Text>
      </View>
    );
  }

  if (!isWeb && !cameraPermission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>
          Camera permission is required to scan QR codes.
        </Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.settingsButtonText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // WEB UI
  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <View style={styles.webContent}>
          <View style={styles.qrIcon}>
            <Text style={styles.qrIconText}>QR</Text>
          </View>

          <Text style={styles.webTitle}>Scan QR Code</Text>
          <Text style={styles.webDescription}>
            Upload a QR code image to access the restaurant menu.
          </Text>

          {scannedUrl && (
            <View style={styles.urlBox}>
              <Text style={styles.urlLabel}>Detected URL:</Text>
              <Text style={styles.urlText}>{scannedUrl}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.webUploadButton}
            onPress={pickImageAndScanQR}
            activeOpacity={0.8}
          >
            <Text style={styles.webUploadButtonText}>
              {scanned ? "Upload Another QR Image" : "Upload QR Image"}
            </Text>
          </TouchableOpacity>

          {scannedUrl && (
            <TouchableOpacity
              style={styles.webOpenButton}
              onPress={() => window.open(scannedUrl, "_blank")}
              activeOpacity={0.8}
            >
              <Text style={styles.webOpenButtonText}>Open Link in New Tab</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.webHint}>
            Select an image containing a clear QR code.
          </Text>
        </View>
      </View>
    );
  }

  // ANDROID UI
  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      >
        <View style={styles.overlay}>
          <View style={styles.scanTarget}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.instructions}>
            Point your camera at a QR code
          </Text>
          <Text style={styles.subInstructions}>
            Or upload a QR image from your gallery
          </Text>
        </View>
      </CameraView>

      <View style={styles.buttonArea}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={pickImageAndScanQR}
          activeOpacity={0.8}
        >
          <Text style={styles.uploadButtonText}>Upload QR Image</Text>
        </TouchableOpacity>

        {scanned && (
          <TouchableOpacity
            style={styles.scanAgainButton}
            onPress={() => {
              setScanned(false);
              setScannedUrl(null);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.scanAgainButtonText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanTarget: { width: 260, height: 260, position: "relative" },
  corner: {
    position: "absolute",
    width: 35,
    height: 35,
    borderColor: "#00FF66",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  instructions: {
    marginTop: 30,
    paddingHorizontal: 30,
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  subInstructions: {
    marginTop: 8,
    paddingHorizontal: 30,
    color: "#ddd",
    fontSize: 14,
    textAlign: "center",
  },
  buttonArea: { position: "absolute", left: 20, right: 20, bottom: 45 },
  uploadButton: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    elevation: 6,
  },
  uploadButtonText: { color: "#111", fontSize: 16, fontWeight: "700" },
  scanAgainButton: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#2196F3",
  },
  scanAgainButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    backgroundColor: "#fff",
  },
  permissionText: { fontSize: 16, textAlign: "center", color: "#111" },
  settingsButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#2196F3",
    borderRadius: 10,
  },
  settingsButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  webContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 30,
  },
  webContent: {
    width: "100%",
    maxWidth: 500,
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 40,
    borderRadius: 20,
  },
  qrIcon: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 25,
  },
  qrIconText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  webTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111",
    marginBottom: 12,
  },
  webDescription: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 20,
  },
  urlBox: {
    backgroundColor: "#eef6ff",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  urlLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2196F3",
    marginBottom: 4,
  },
  urlText: { fontSize: 14, color: "#111", fontWeight: "500" },
  webUploadButton: {
    width: "100%",
    paddingVertical: 17,
    borderRadius: 14,
    backgroundColor: "#111",
    alignItems: "center",
  },
  webUploadButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  webOpenButton: {
    width: "100%",
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: "#2196F3",
    alignItems: "center",
  },
  webOpenButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  webHint: { marginTop: 20, fontSize: 13, color: "#999", textAlign: "center" },
});
