import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { api, API_BASE_URL } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useGoalStore } from '../../../store/useGoalStore';
import Toast from 'react-native-toast-message';

type UserData = {
  _id: string;
  fullName?: string;
  email: string;
  gender: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  tdee: number;
  subscriptionStatus?: 'trial' | 'active' | 'expired' | 'none';
  subscriptionEndDate?: string;
};


type ProfileData = {
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  fitnessGoal: string;
  activityLevel: string;
  dietPreference: string;
  bmi: number;
  dailyCalories: number;
  targetWeight?: number;
  workoutTimePreference: string;
  profileImage?: string;
};

const GENDER_OPTIONS = ['male', 'female', 'other'];
const ACTIVITY_OPTIONS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOAL_OPTIONS = ['lose_weight', 'stay_fit', 'build_muscle'];
const DIET_OPTIONS = ['veg', 'non_veg', 'vegan'];
const WORKOUT_TIME_OPTIONS = ['morning', 'afternoon', 'evening', 'night', 'flexible'];

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [user, setUser] = useState<UserData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Edit states
  const [editAge, setEditAge] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editActivity, setEditActivity] = useState('');
  const [editGoal, setEditGoal] = useState('');
  const [editDiet, setEditDiet] = useState('');
  const [editName, setEditName] = useState('');
  const [editTargetWeight, setEditTargetWeight] = useState('');
  const [editWorkoutPreference, setEditWorkoutPreference] = useState('');

  const CACHE_KEY = '@profile_data';

  const fetchProfile = async () => {
    try {
      // 1. Try to load from cache first for immediate rendering
      const cachedString = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedString) {
        const cachedData = JSON.parse(cachedString);
        populateProfileState(cachedData);
        setLoading(false); // Stop loading immediately if cache exists
      }

      // 2. Fetch fresh data from network in background
      const res = await api.get('/api/v1/profile');
      if (res.data.success) {
        const newData = res.data.data;
        populateProfileState(newData);

        // Save fresh data to cache
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newData));
      }
    } catch (err: any) {
      if (!user) {
        Alert.alert("Error", "Could not load profile. Please sign in again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const populateProfileState = (data: { user: UserData; profile: ProfileData }) => {
    setUser(data.user);
    if (data.profile) {
      setProfile(data.profile);
      setEditName(data.user.fullName || '');
      setEditAge(String(data.profile.age));
      setEditHeight(String(data.profile.heightCm));
      setEditWeight(String(data.profile.weightKg));
      setEditGender(data.profile.gender);
      setEditActivity(data.profile.activityLevel);
      setEditGoal(data.profile.fitnessGoal);
      setEditDiet(data.profile.dietPreference);
      setEditTargetWeight(data.profile.targetWeight ? String(data.profile.targetWeight) : '');
      setEditWorkoutPreference(data.profile.workoutTimePreference || 'flexible');
    }
  };


  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setLoading(true);
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      const formData = new FormData();
      formData.append('file', { uri, name: filename, type } as any);

      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/api/v1/profile/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setProfile(prev => prev ? { ...prev, profileImage: data.data.profileImage } : null);
      } else {
        Alert.alert('Upload Failed', data.message);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setLoading(false);
    }
  };

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoalsSummary, setNewGoalsSummary] = useState({ calories: 0, protein: 0 });

  const saveChanges = async () => {
    try {
      setSaving(true);
      const isWeightChanged = Number(editWeight) !== profile?.weightKg;

      const payload = {
        fullName: editName,
        age: Number(editAge),
        heightCm: Number(editHeight),
        weightKg: Number(editWeight),
        gender: editGender,
        activityLevel: editActivity,
        fitnessGoal: editGoal,
        dietPreference: editDiet,
        targetWeight: Number(editTargetWeight),
        workoutTimePreference: editWorkoutPreference,
      };

      const res = await api.put('/api/v1/profile/update', payload);
      if (res.data.success) {
        const newData = res.data.data;
        setUser(newData.user);
        setProfile(newData.profile);

        // Update Zustand store in real-time
        if (newData.goals) {
          useGoalStore.getState().setGoals({
            calorieGoal: newData.goals.calorieGoal,
            proteinGoal: newData.goals.proteinGoal,
            carbsGoal: newData.goals.carbsGoal,
            fatGoal: newData.goals.fatGoal,
            waterGoal: newData.goals.waterGlasses,
            stepGoal: newData.goals.stepGoal,
          });

          Toast.show({
            type: 'success',
            text1: 'Goals Updated! 🎯',
            text2: `Daily: ${newData.goals.calorieGoal} kcal | P: ${newData.goals.proteinGoal}g | C: ${newData.goals.carbsGoal}g | F: ${newData.goals.fatGoal}g`,
            visibilityTime: 6000,
          });

          setNewGoalsSummary({
            calories: newData.goals.calorieGoal,
            protein: newData.goals.proteinGoal,
          });
        }

        if (isWeightChanged) {
          setShowGoalModal(true);
        } else {
          setIsEditMode(false);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', 'Could not save profile changes');
    } finally {
      setSaving(false);
    }
  };

  const performLogout = async () => {
    await AsyncStorage.removeItem(CACHE_KEY);
    await logout();
  };

  const performDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure? This action is permanent and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await api.delete('/api/v1/profile/delete');
              await AsyncStorage.removeItem(CACHE_KEY);
              await logout();
            } catch (err) {
              Alert.alert('Error', 'Could not delete account');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading && !profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF8C00" />
      </View>
    );
  }

  const renderChipOptions = (options: string[], selectedValue: string, onSelect: (v: string) => void) => (
    <View style={styles.chipRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, selectedValue === opt && styles.chipSelected]}
          onPress={() => onSelect(opt)}
        >
          <Text style={[styles.chipText, selectedValue === opt && styles.chipTextSelected]}>
            {opt.replace('_', ' ')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsEditMode(!isEditMode)} style={styles.editBtn}>
          <Text style={styles.editBtnText}>{isEditMode ? 'Cancel' : 'Edit Profile'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* AVATAR SECTION */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} style={styles.avatarWrapper}>
            {profile?.profileImage ? (
              <Image
                source={{ uri: profile.profileImage }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>{user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}</Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </TouchableOpacity>

          {isEditMode ? (
            <TextInput
              style={styles.nameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your Name"
            />
          ) : (
            <Text style={styles.userName}>{user?.fullName || 'Anonymous User'}</Text>
          )}
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* STATS ROW */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>BMI</Text>
            <Text style={styles.statVal}>{profile?.bmi}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Curr. Wt</Text>
            <Text style={styles.statVal}>{profile?.weightKg} kg</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Cal. Goal</Text>
            <Text style={styles.statVal}>{profile?.dailyCalories} kcal</Text>
          </View>
        </View>

        {/* SUBSCRIPTION CARD */}
        {user?.subscriptionStatus === 'active' ? (
          <View style={[styles.card, styles.proCard]}>
            <View style={styles.proHeader}>
              <Text style={styles.proTitle}>✅ PRO Member</Text>
              <View><Text style={styles.crownIcon}>👑</Text></View>
            </View>
            <Text style={styles.proExpiry}>
              Expires on: {user.subscriptionEndDate ? new Date(user.subscriptionEndDate).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.card, styles.upgradeCard]}
            onPress={() => router.push('/paywall')}
          >
            <View style={styles.upgradeHeader}>
              <Text style={styles.upgradeTitle}>Upgrade to PRO 👑</Text>
              <View style={styles.upgradeBadge}><Text style={styles.upgradeBadgeText}>SAVE 50%</Text></View>
            </View>
            <Text style={styles.upgradeSubtitle}>Get AI Food Scanner, Unlimited meal logging, analytics and more!</Text>
            <View style={[styles.saveBtn, { marginTop: 12, paddingVertical: 12 }]}>
              <Text style={styles.saveBtnText}>Upgrade Now</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* INFO SECTION */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Info</Text>


          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age</Text>
            {isEditMode ? (
              <TextInput style={styles.textInput} value={editAge} onChangeText={setEditAge} keyboardType="numeric" />
            ) : (
              <Text style={styles.infoVal}>{profile?.age} yrs</Text>
            )}
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Height</Text>
            {isEditMode ? (
              <View style={styles.inputGroup}>
                <TextInput style={styles.textInputShort} value={editHeight} onChangeText={setEditHeight} keyboardType="numeric" />
                <Text> cm</Text>
              </View>
            ) : (
              <Text style={styles.infoVal}>{profile?.heightCm} cm</Text>
            )}
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Weight</Text>
            {isEditMode ? (
              <View style={styles.inputGroup}>
                <TextInput style={styles.textInputShort} value={editWeight} onChangeText={setEditWeight} keyboardType="numeric" />
                <Text> kg</Text>
              </View>
            ) : (
              <Text style={styles.infoVal}>{profile?.weightKg} kg</Text>
            )}
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Target Weight</Text>
            {isEditMode ? (
              <View style={styles.inputGroup}>
                <TextInput style={styles.textInputShort} value={editTargetWeight} onChangeText={setEditTargetWeight} keyboardType="numeric" />
                <Text> kg</Text>
              </View>
            ) : (
              <Text style={styles.infoVal}>{profile?.targetWeight || '--'} kg</Text>
            )}
          </View>
          <View style={styles.divider} />

          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Workout Preference</Text>
            {isEditMode ? renderChipOptions(WORKOUT_TIME_OPTIONS, editWorkoutPreference, setEditWorkoutPreference) : <Text style={styles.infoVal}>{profile?.workoutTimePreference}</Text>}
          </View>
          <View style={styles.divider} />

          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Gender</Text>
            {isEditMode ? renderChipOptions(GENDER_OPTIONS, editGender, setEditGender) : <Text style={styles.infoVal}>{profile?.gender}</Text>}
          </View>
          <View style={styles.divider} />

          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Goal</Text>
            {isEditMode ? renderChipOptions(GOAL_OPTIONS, editGoal, setEditGoal) : <Text style={styles.infoVal}>{profile?.fitnessGoal.replace('_', ' ')}</Text>}
          </View>
          <View style={styles.divider} />

          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Activity Level</Text>
            {isEditMode ? renderChipOptions(ACTIVITY_OPTIONS, editActivity, setEditActivity) : <Text style={styles.infoVal}>{profile?.activityLevel.replace('_', ' ')}</Text>}
          </View>
          <View style={styles.divider} />

          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Diet Preference</Text>
            {isEditMode ? renderChipOptions(DIET_OPTIONS, editDiet, setEditDiet) : <Text style={styles.infoVal}>{profile?.dietPreference.replace('_', ' ')}</Text>}
          </View>

          {isEditMode && (
            <TouchableOpacity style={styles.saveBtn} onPress={saveChanges} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* SUPPORT & LEGAL SECTION */}
        {!isEditMode && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Support & Legal</Text>

            <TouchableOpacity style={styles.menuRow} onPress={() => Alert.alert('Help & Support', 'Contact us at support@caloxi.com for any assistance.')}>
              <View style={styles.menuRowLeft}>
                <Text style={styles.menuIcon}>❓</Text>
                <Text style={styles.menuLabel}>Help & Support</Text>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/privacy-policy')}>
              <View style={styles.menuRowLeft}>
                <Text style={styles.menuIcon}>🔒</Text>
                <Text style={styles.menuLabel}>Privacy Policy</Text>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* DANGER ZONE */}
        {!isEditMode && (
          <View style={styles.dangerZone}>
            <TouchableOpacity style={styles.logoutBtn} onPress={performLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={performDeleteAccount}>
              <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Caloxi v1.0.0 (1)</Text>
          <Text style={styles.footerText}>Made with ❤️ for a healthier you</Text>
        </View>
      </ScrollView>

      {/* GOAL SUMMARY MODAL */}
      <Modal
        visible={showGoalModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Goals Calculated!</Text>
            <Text style={styles.modalSubtitle}>Based on your new weight, we've updated your daily targets:</Text>

            <View style={styles.modalStatRow}>
              <View style={styles.modalStat}>
                <Text style={styles.modalStatSymbol}>🔥</Text>
                <Text style={styles.modalStatLabel}>Calorie Goal</Text>
                <Text style={styles.modalStatVal}>{newGoalsSummary.calories} kcal</Text>
              </View>
              <View style={styles.modalStat}>
                <Text style={styles.modalStatSymbol}>🥩</Text>
                <Text style={styles.modalStatLabel}>Protein Goal</Text>
                <Text style={styles.modalStatVal}>{newGoalsSummary.protein}g</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                setShowGoalModal(false);
                setIsEditMode(false);
              }}
            >
              <Text style={styles.modalCloseBtnText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE1D3'
  },
  backBtn: {
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  editBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  editBtnText: {
    fontSize: 14,
    color: '#FF8C00',
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eee'
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  nameInput: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#FF8C00',
    paddingBottom: 4,
    minWidth: 150,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: '#fff',
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    fontWeight: '600'
  },
  statVal: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoCol: {
    paddingVertical: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0E6D2',
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
    marginBottom: 4,
  },
  infoVal: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  textInput: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#FF8C00',
    minWidth: 60,
    textAlign: 'right'
  },
  textInputShort: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#FF8C00',
    minWidth: 40,
    textAlign: 'center'
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    backgroundColor: '#F5F0E8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#FF8C00',
  },
  chipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  chipTextSelected: {
    color: '#fff',
  },
  saveBtn: {
    backgroundColor: '#FF8C00',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dangerZone: {
    marginTop: 10,
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FF6B6B',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  deleteText: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 5,
  },
  modalStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
  },
  modalStat: {
    alignItems: 'center',
    flex: 1,
  },
  modalStatSymbol: {
    fontSize: 24,
    marginBottom: 8,
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  modalStatVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseBtn: {
    backgroundColor: '#FF8C00',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  proCard: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  proHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  proTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  crownIcon: {
    fontSize: 20,
  },
  proExpiry: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 8,
  },
  manageLink: {
    fontSize: 14,
    color: '#1976D2',
    textDecorationLine: 'underline',
  },
  upgradeCard: {
    backgroundColor: '#6C63FF',
    padding: 16,
    borderWidth: 0,
  },
  upgradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  upgradeBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  upgradeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  upgradeSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  menuArrow: {
    color: '#CCC',
  },
  footer: {
    marginTop: 40,
    marginBottom: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 4,
  },
});

