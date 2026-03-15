import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  Alert, 
  Dimensions, 
  Animated, 
  Easing,
  PanResponder,
  Platform,
  ScrollView,
  StatusBar
} from 'react-native';
import { CameraView, useCameraPermissions, FlashMode } from 'expo-camera';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { api } from '../../lib/api';
import { useGoals } from '../../context/GoalContext';

const { width, height } = Dimensions.get('window');
const SCAN_FRAME_SIZE = width * 0.7;

type NutritionInfo = {
  foodName: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  description: string;
  ingredients: string[];
  emoji?: string;
};

const IngredientCard = ({ name }: { name: string }) => {
  const [loading, setLoading] = useState(true);
  const imageUrl = `https://loremflickr.com/200/200/food,${name.replace(/ /g, ',')}`;

  return (
    <View style={styles.ingredientCard}>
      <View style={styles.ingredientImageContainer}>
        {loading && <View style={[styles.ingredientImage, styles.skeleton]} />}
        <Image 
          source={{ uri: imageUrl }} 
          style={styles.ingredientImage} 
          onLoadEnd={() => setLoading(false)}
        />
      </View>
      <Text style={styles.ingredientName} numberOfLines={1}>{name}</Text>
    </View>
  );
};

export default function ScanScreen() {
  const router = useRouter();
  const { goals } = useGoals();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  
  // Camera States
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [zoom, setZoom] = useState(0);
  
  // UI States
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [lastImage, setLastImage] = useState<string | null>(null);
  
  // Animation States
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(height)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Slider Logic
  const sliderWidth = width - 80;
  const zoomPan = useRef(new Animated.Value(sliderWidth / 2)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        let newX = gestureState.moveX - 40;
        if (newX < 0) newX = 0;
        if (newX > sliderWidth) newX = sliderWidth;
        zoomPan.setValue(newX);
        const newZoom = newX / sliderWidth;
        setZoom(newZoom);
      },
    })
  ).current;

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_FRAME_SIZE],
  });

  useEffect(() => {
    if (!photoUri) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [photoUri]);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centerAll]}>
        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnPrimaryText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleFacing = () => setFacing(prev => prev === 'back' ? 'front' : 'back');
  const toggleFlash = () => setFlash(prev => prev === 'off' ? 'on' : 'off');

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
        if (photo && photo.uri && photo.base64) {
          setPhotoUri(photo.uri);
          setLastImage(photo.uri);
          setImageBase64(photo.base64);
          analyzeImage(photo.base64);
        }
      } catch (e) {
        console.error('Failed to take picture:', e);
      }
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setLastImage(asset.uri);
      setImageBase64(asset.base64 as string);
      analyzeImage(asset.base64 as string);
    }
  };

  const analyzeImage = async (base64String: string) => {
    setAnalyzing(true);
    try {
      const resp = await api.post('/api/v1/food/analyze', {
        imageBase64: base64String,
      });
      if (resp.data.success) {
        setNutritionData(resp.data.data.data || resp.data.data);
        showSheet();
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      Alert.alert('Analysis Failed', 'Could not analyze the food image.');
      retake();
    } finally {
      setAnalyzing(false);
    }
  };

  const retake = () => {
    hideSheet(() => {
      setPhotoUri(null);
      setImageBase64(null);
      setNutritionData(null);
      setAnalyzing(false);
      setDescriptionExpanded(false);
    });
  };

  const showSheet = () => {
    Animated.parallel([
      Animated.spring(sheetAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideSheet = (callback?: () => void) => {
    Animated.parallel([
      Animated.spring(sheetAnim, {
        toValue: height,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback) callback();
    });
  };

  const handleAction = async (type: 'eat' | 'test') => {
    if (!nutritionData || !imageBase64) return;
    try {
      await api.post('/api/v1/food/save', {
        ...nutritionData,
        imageBase64,
        type,
      });
      if (type === 'eat') {
        Alert.alert('Success', 'Food logged successfully!');
      } else {
        Alert.alert('Test Saved', 'Scan saved as test for 7 days.');
      }
      router.back();
    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert('Error', 'Failed to save food scan.');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {!photoUri ? (
        <View style={styles.cameraContainer}>
          <CameraView 
            ref={cameraRef} 
            style={StyleSheet.absoluteFill} 
            facing={facing}
            flash={flash}
            zoom={zoom}
          />
          
          {/* Header Controls */}
          <View style={styles.topHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
              <Ionicons name="chevron-back" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleFlash} style={styles.circleBtn}>
              <Ionicons 
                name={flash === 'on' ? "flash" : "flash-off"} 
                size={24} 
                color={flash === 'on' ? "#FF6B00" : "#000"} 
              />
            </TouchableOpacity>
          </View>

          {/* Scan Overlay */}
          <View style={styles.overlayContainer}>
            <View style={styles.scanTarget}>
              {/* Corner Brackets */}
              <Svg height={SCAN_FRAME_SIZE} width={SCAN_FRAME_SIZE} style={styles.brackets}>
                <Path d="M 0 40 L 0 0 L 40 0" stroke="white" strokeWidth="4" fill="transparent" />
                <Path d={`M ${SCAN_FRAME_SIZE - 40} 0 L ${SCAN_FRAME_SIZE} 0 L ${SCAN_FRAME_SIZE} 40`} stroke="white" strokeWidth="4" fill="transparent" />
                <Path d={`M 0 ${SCAN_FRAME_SIZE - 40} L 0 ${SCAN_FRAME_SIZE} L 40 ${SCAN_FRAME_SIZE}`} stroke="white" strokeWidth="4" fill="transparent" />
                <Path d={`M ${SCAN_FRAME_SIZE - 40} ${SCAN_FRAME_SIZE} L ${SCAN_FRAME_SIZE} ${SCAN_FRAME_SIZE} L ${SCAN_FRAME_SIZE} ${SCAN_FRAME_SIZE - 40}`} stroke="white" strokeWidth="4" fill="transparent" />
              </Svg>
              <Animated.View 
                style={[
                  styles.scanLine, 
                  { transform: [{ translateY: scanLineTranslateY }] }
                ]} 
              />
            </View>
          </View>

          {/* Bottom Panel */}
          <View style={styles.bottomPanel}>
            <BlurView intensity={30} tint="light" style={styles.blurBg} />
            
            {/* Zoom Slider */}
            <View style={styles.zoomContainer}>
              <Text style={styles.zoomText}>{(zoom * 2 + 1).toFixed(1)}x</Text>
              <View style={styles.sliderTrack}>
                {[...Array(21)].map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.sliderTick, 
                      i === 10 && styles.sliderTickMain,
                      { height: i % 5 === 0 ? 15 : 8 }
                    ]} 
                  />
                ))}
                <Animated.View 
                  style={[styles.sliderHandle, { left: zoomPan }]} 
                  {...panResponder.panHandlers}
                />
              </View>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={pickFromGallery} style={styles.thumbBtn}>
                {lastImage ? (
                  <Image source={{ uri: lastImage }} style={styles.thumbImg} />
                ) : (
                  <Ionicons name="images" size={24} color="#fff" />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={takePicture} style={styles.captureOuter}>
                <View style={styles.captureInner}>
                  <View style={styles.captureSquare} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleFacing} style={styles.flipBtn}>
                <Ionicons name="camera-reverse" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <BlurView intensity={Platform.OS === 'ios' ? 20 : 40} tint="light" style={StyleSheet.absoluteFill} />
          
          <StatusBar barStyle="light-content" />

          {analyzing && (
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text style={styles.analyzingText}>Analyzing macros...</Text>
            </View>
          )}

          {/* RESULTS BOTTOM SHEET */}
          {nutritionData && !analyzing && (
            <Animated.View 
              style={[
                styles.resultSheet,
                { transform: [{ translateY: sheetAnim }] }
              ]}
            >
              <View style={styles.sheetHandle} />
              
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
                <View style={styles.headerRow}>
                  <Text style={styles.foodTitle}>{nutritionData.foodName}</Text>
                  <View style={styles.caloriePill}>
                    <Text style={styles.calorieText}>🔥 {nutritionData.calories} kcal</Text>
                  </View>
                </View>
                <Text style={styles.goalPercent}>
                  {goals.calorieGoal > 0 ? `${Math.round((nutritionData.calories / goals.calorieGoal) * 100)}% of your daily ${goals.calorieGoal} kcal goal` : ''}
                </Text>

                <View style={styles.macroRow}>
                  <View style={styles.macroPill}><Text style={styles.macroPillText}>Protein: {nutritionData.protein}g</Text></View>
                  <View style={styles.macroPill}><Text style={styles.macroPillText}>Carbs: {nutritionData.carbs}g</Text></View>
                  <View style={styles.macroPill}><Text style={styles.macroPillText}>Fat: {nutritionData.fat}g</Text></View>
                </View>

                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                  style={styles.descriptionSection}
                >
                  <Text 
                    style={styles.descriptionText} 
                    numberOfLines={descriptionExpanded ? undefined : 2}
                  >
                    {nutritionData.description}
                  </Text>
                  {!descriptionExpanded && <Text style={styles.readMore}>Read more</Text>}
                </TouchableOpacity>

                <View style={styles.ingredientsSection}>
                  <Text style={styles.sectionTitle}>Ingredients</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.ingredientsList}
                  >
                    {nutritionData.ingredients.map((ing, idx) => (
                      <IngredientCard key={idx} name={ing} />
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity 
                    style={styles.btnLog} 
                    onPress={() => handleAction('eat')}
                  >
                    <Text style={styles.btnLogText}>Add meal</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.btnBookmark} 
                    onPress={() => handleAction('test')}
                  >
                    <Ionicons name="bookmark" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.cancelBtn} onPress={retake}>
                  <Text style={styles.cancelText}>Retake Photo</Text>
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerAll: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  btnPrimary: {
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTarget: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    position: 'relative',
  },
  brackets: {
    position: 'absolute',
  },
  scanLine: {
    height: 2,
    width: '100%',
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 220,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    padding: 20,
  },
  blurBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  zoomContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  zoomText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  sliderTrack: {
    width: width - 80,
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  sliderTick: {
    width: 1,
    backgroundColor: '#888',
  },
  sliderTickMain: {
    width: 2,
    backgroundColor: '#000',
    height: 20,
  },
  sliderHandle: {
    position: 'absolute',
    width: 2,
    height: 40,
    backgroundColor: '#000',
    zIndex: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  thumbBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  flipBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  captureSquare: {
    width: 24,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 6,
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 18,
    fontWeight: '600',
  },
  resultSheet: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  foodTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  statCard: {
    width: '23%',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 15,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  statLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  sheetBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnEat: {
    backgroundColor: '#FF6B00',
  },
  btnEatText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnTest: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  btnTestText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelBtn: {
    alignItems: 'center',
  },
  cancelText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  // New Styles
  sheetContent: {
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  caloriePill: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  calorieText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  macroPill: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  macroPillText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  descriptionSection: {
    marginBottom: 25,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
  },
  readMore: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  ingredientsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1a1a1a',
  },
  ingredientsList: {
    gap: 15,
    paddingRight: 20,
  },
  ingredientCard: {
    alignItems: 'center',
    width: 70,
  },
  ingredientImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  ingredientImage: {
    width: '100%',
    height: '100%',
  },
  ingredientName: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: '#e1e1e1',
    position: 'absolute',
    zIndex: 1,
  },
  btnLog: {
    flex: 1,
    backgroundColor: '#000',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnLogText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnBookmark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalPercent: {
    fontSize: 13,
    color: '#FF6B00',
    fontWeight: '600',
    marginBottom: 16,
    marginTop: -8,
  },
});
