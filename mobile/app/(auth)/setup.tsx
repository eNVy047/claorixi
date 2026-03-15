import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  Dimensions,
  TextInput,
  ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../lib/api';

const { width } = Dimensions.get('window');

type StepData = {
  age: string;
  gender: 'male' | 'female' | 'other' | '';
  heightCm: string;
  weightKg: string;
  fitnessGoal: 'lose_weight' | 'build_muscle' | 'stay_fit' | '';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '';
  dietPreference: 'veg' | 'non_veg' | 'vegan' | '';
};

export default function SetupScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [formData, setFormData] = useState<StepData>({
    age: '',
    gender: '',
    heightCm: '',
    weightKg: '',
    fitnessGoal: '',
    activityLevel: '',
    dietPreference: '',
  });

  const nextStep = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };
  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.age && formData.gender;
      case 2:
        return formData.heightCm && formData.weightKg;
      case 3:
        return formData.fitnessGoal && formData.activityLevel;
      case 4:
        return formData.dietPreference !== '';
      default:
        return false;
    }
  };

  const onSubmit = async () => {
    setApiError(null);
    setIsSubmitting(true);
    try {
      const response = await api.post(`/api/v1/profile/setup`, {
        age: Number(formData.age),
        gender: formData.gender,
        heightCm: Number(formData.heightCm),
        weightKg: Number(formData.weightKg),
        fitnessGoal: formData.fitnessGoal,
        activityLevel: formData.activityLevel,
        dietPreference: formData.dietPreference,
      });

      if (response.data.success) {
        // Setup complete, user is verified, move to dashboard
        router.replace('/(tabs)/(dashboard)');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setApiError(err.response?.data?.message || 'Failed to sync profile. Try again.');
      console.log('Setup Error:', err.response?.data || err.message);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBarFill, { width: `${(currentStep / totalSteps) * 100}%` }]} />
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {renderProgressBar()}

        <View style={styles.header}>
          <Text style={styles.title}>Let's personalize your plan</Text>
          <Text style={styles.subtitle}>Step {currentStep} of {totalSteps}</Text>
        </View>

        {apiError && <Text style={styles.apiError}>{apiError}</Text>}

        <View style={styles.mainContent}>
          
          {/* STEP 1: Age & Gender */}
          {currentStep === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.question}>What is your age and gender?</Text>
              
              <Text style={styles.label}>Age (years)</Text>
              <TextInput
                style={styles.input}
                placeholder="25"
                keyboardType="numeric"
                value={formData.age}
                onChangeText={(text) => setFormData({ ...formData, age: text.replace(/[^0-9]/g, '') })}
                maxLength={3}
              />

              <Text style={[styles.label, { marginTop: 20 }]}>Gender</Text>
              <View style={styles.optionsRow}>
                {['male', 'female', 'other'].map((g) => (
                  <TouchableOpacity 
                    key={g} 
                    style={[styles.optionCard, formData.gender === g && styles.optionCardActive]}
                    onPress={() => setFormData({ ...formData, gender: g as any })}
                  >
                    <Text style={[styles.optionText, formData.gender === g && styles.optionTextActive]}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* STEP 2: Height & Weight */}
          {currentStep === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.question}>What are your current body metrics?</Text>
              
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                placeholder="175"
                keyboardType="numeric"
                value={formData.heightCm}
                onChangeText={(text) => setFormData({ ...formData, heightCm: text.replace(/[^0-9]/g, '') })}
                maxLength={3}
              />

              <Text style={[styles.label, { marginTop: 20 }]}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="70"
                keyboardType="numeric"
                value={formData.weightKg}
                onChangeText={(text) => setFormData({ ...formData, weightKg: text.replace(/[^0-9]/g, '') })}
                maxLength={3}
              />
            </View>
          )}

          {/* STEP 3: Goals & Activity Level */}
          {currentStep === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.question}>What is your primary goal?</Text>
              <View style={styles.optionsColumn}>
                {[
                  { id: 'lose_weight', label: 'Lose Weight (-500 cal/day)' },
                  { id: 'build_muscle', label: 'Build Muscle (+500 cal/day)' },
                  { id: 'stay_fit', label: 'Stay Fit (Maintenance)' }
                ].map((goal) => (
                  <TouchableOpacity 
                    key={goal.id} 
                    style={[styles.optionRowList, formData.fitnessGoal === goal.id && styles.optionCardActive]}
                    onPress={() => setFormData({ ...formData, fitnessGoal: goal.id as any })}
                  >
                    <Text style={[styles.optionRowText, formData.fitnessGoal === goal.id && styles.optionTextActive]}>
                      {goal.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.question, { marginTop: 30 }]}>How active are you?</Text>
              <View style={styles.optionsColumn}>
                {[
                  { id: 'sedentary', label: 'Sedentary (Little to no exercise)' },
                  { id: 'light', label: 'Lightly Active (1-3 days/wk)' },
                  { id: 'moderate', label: 'Moderately Active (3-5 days/wk)' },
                  { id: 'active', label: 'Very Active (6-7 days/wk)' },
                ].map((act) => (
                  <TouchableOpacity 
                    key={act.id} 
                    style={[styles.optionRowList, formData.activityLevel === act.id && styles.optionCardActive]}
                    onPress={() => setFormData({ ...formData, activityLevel: act.id as any })}
                  >
                    <Text style={[styles.optionRowText, formData.activityLevel === act.id && styles.optionTextActive]}>
                      {act.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* STEP 4: Diet Preferences */}
          {currentStep === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.question}>Do you have a diet preference?</Text>
              <View style={styles.optionsColumn}>
                {[
                  { id: 'veg', label: 'Vegetarian' },
                  { id: 'non_veg', label: 'Non-Vegetarian (Omnivore)' },
                  { id: 'vegan', label: 'Vegan' },
                ].map((diet) => (
                  <TouchableOpacity 
                    key={diet.id} 
                    style={[styles.optionRowList, formData.dietPreference === diet.id && styles.optionCardActive]}
                    onPress={() => setFormData({ ...formData, dietPreference: diet.id as any })}
                  >
                    <Text style={[styles.optionRowText, formData.dietPreference === diet.id && styles.optionTextActive]}>
                      {diet.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

        </View>

        {/* Navigation Buttons */}
        <View style={styles.footer}>
          {currentStep > 1 ? (
            <TouchableOpacity style={styles.backButton} onPress={prevStep} disabled={isSubmitting}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          ) : <View style={{ flex: 1 }} />}

          <TouchableOpacity 
            style={[styles.nextButton, !isStepValid() && styles.nextButtonDisabled]} 
            onPress={currentStep === totalSteps ? onSubmit : nextStep}
            disabled={!isStepValid() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextText}>
                {currentStep === totalSteps ? 'Finish Setup' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5DC', // Soft Cream
  },
  scrollContainer: {
    flexGrow: 1,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 32,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF8C00', // Orange
    borderRadius: 3,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
  apiError: {
    backgroundColor: '#fdecea',
    color: '#e74c3c',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
    overflow: 'hidden',
  },
  mainContent: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#333',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  optionCardActive: {
    borderColor: '#FF8C00',
    backgroundColor: '#FFF4E6',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  optionTextActive: {
    color: '#FF8C00',
    fontWeight: 'bold',
  },
  optionsColumn: {
    gap: 12,
  },
  optionRowList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionRowText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#444',
  },
  footer: {
    flexDirection: 'row',
    marginTop: 40,
    gap: 16,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#FF8C00',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  nextButtonDisabled: {
    backgroundColor: '#FFB870', // Light orange
    elevation: 0,
    shadowOpacity: 0,
  },
  nextText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
