import { UserProfile, IUserProfile } from '../../models/UserProfile';
import { User } from '../../models/User';
import { ProfileSetupInput, ProfileUpdateInput } from './profile.schema';
import { ConflictError, NotFoundError } from '../../utils/errors';

export class ProfileService {
  /**
   * Calculate BMI
   */
  static calculateBMI(weightKg: number, heightCm: number): number {
    const heightM = heightCm / 100;
    return Number((weightKg / (heightM * heightM)).toFixed(2));
  }

  /**
   * Calculate Base BMR using Harris-Benedict Formula
   */
  static calculateBMR(age: number, gender: string, weightKg: number, heightCm: number): number {
    if (gender === 'female') {
      return 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age);
    } 
    // Default to male calculation for 'male' and 'other' for estimation
    return 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age);
  }

  /**
   * Calculate TDEE (Total Daily Energy Expenditure) 
   * based on Activity Level & Fitness Goal
   */
  static calculateTDEE(bmr: number, activityLevel: string, fitnessGoal: string): number {
    let activityMultiplier = 1.2; // sedentary

    switch (activityLevel) {
      case 'light': activityMultiplier = 1.375; break;
      case 'moderate': activityMultiplier = 1.55; break;
      case 'active': activityMultiplier = 1.725; break;
      case 'very_active': activityMultiplier = 1.9; break;
    }

    const tdee = bmr * activityMultiplier;

    // Adjust the daily calories based on the goal
    switch (fitnessGoal) {
      case 'lose_weight': return Math.round(tdee - 500); // Create deficit
      case 'build_muscle': return Math.round(tdee + 300); // Create surplus
      case 'stay_fit':
      default:
        return Math.round(tdee); // Maintenance
    }
  }

  /**
   * Calculate all dynamic user goals from profile
   */
  static calculateGoals(profile: {
    age: number;
    gender: string;
    weightKg: number;
    heightCm: number;
    activityLevel: string;
    fitnessGoal: string;
  }) {
    const bmr = this.calculateBMR(profile.age, profile.gender, profile.weightKg, profile.heightCm);
    const calorieGoal = this.calculateTDEE(bmr, profile.activityLevel, profile.fitnessGoal);

    // Macro split
    const proteinGoal = Math.round((calorieGoal * 0.30) / 4);
    const carbsGoal = Math.round((calorieGoal * 0.40) / 4);
    const fatGoal = Math.round((calorieGoal * 0.30) / 9);

    // Water
    const waterGoalLiters = profile.weightKg * 0.033;
    const waterGlasses = Math.round(waterGoalLiters / 0.25);

    // Steps based on activity level
    let stepGoal = 8000;
    switch (profile.activityLevel) {
      case 'light': stepGoal = 10000; break;
      case 'moderate': stepGoal = 12000; break;
      case 'active':
      case 'very_active': stepGoal = 15000; break;
    }

    // Calorie burn goal: 15% of TDEE
    const caloriesBurntGoal = Math.round(calorieGoal * 0.15);

    // Sleep goal based on age
    let sleepGoal = 8;
    if (profile.age < 18) sleepGoal = 9;
    else if (profile.age > 60) sleepGoal = 7;

    return {
      calorieGoal,
      proteinGoal,
      carbsGoal,
      fatGoal,
      waterGlasses,
      stepGoal,
      caloriesBurntGoal,
      sleepGoal,
    };
  }

  static async setupProfile(userId: string, data: ProfileSetupInput): Promise<IUserProfile> {
    // 1. Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // 2. Check if a profile already exists
    const existingProfile = await UserProfile.findOne({ userId });
    if (existingProfile) {
      throw new ConflictError('Profile already exists for this user. Use the update endpoint instead.');
    }

    // 3. Compute derived values
    const bmi = this.calculateBMI(data.weightKg, data.heightCm);
    const bmr = this.calculateBMR(data.age, data.gender, data.weightKg, data.heightCm);
    const dailyCalories = this.calculateTDEE(bmr, data.activityLevel, data.fitnessGoal);

    // 4. Create and save profile
    const profile = new UserProfile({
      userId,
      ...data,
      bmi,
      dailyCalories,
    });

    await profile.save();

    // 5. Also sync core metrics back up to the User document for easier top-level querying
    user.gender = data.gender;
    user.heightCm = data.heightCm;
    user.weightKg = data.weightKg;
    user.activityLevel = data.activityLevel;
    user.bmr = bmr;
    user.tdee = dailyCalories;
    await user.save();

    return profile;
  }

  static async getProfile(userId: string) {
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const profile = await UserProfile.findOne({ userId });
    return { user, profile };
  }

  static async updateProfile(userId: string, data: ProfileUpdateInput) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      throw new NotFoundError('Profile not found. Please setup profile first.');
    }

    // Update simple fields on User model
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.gender !== undefined) user.gender = data.gender;
    if (data.heightCm !== undefined) user.heightCm = data.heightCm;
    if (data.weightKg !== undefined) user.weightKg = data.weightKg;
    if (data.activityLevel !== undefined) user.activityLevel = data.activityLevel;

    // Update simple fields on Profile model
    if (data.age !== undefined) profile.age = data.age;
    if (data.gender !== undefined) profile.gender = data.gender;
    if (data.heightCm !== undefined) profile.heightCm = data.heightCm;
    if (data.weightKg !== undefined) profile.weightKg = data.weightKg;
    if (data.fitnessGoal !== undefined) profile.fitnessGoal = data.fitnessGoal;
    if (data.activityLevel !== undefined) profile.activityLevel = data.activityLevel;
    if (data.dietPreference !== undefined) profile.dietPreference = data.dietPreference;

    // Recalculate BMI & TDEE if physical stats changed
    if (data.weightKg !== undefined || data.heightCm !== undefined || data.age !== undefined || data.gender !== undefined || data.activityLevel !== undefined || data.fitnessGoal !== undefined) {
      profile.bmi = this.calculateBMI(profile.weightKg, profile.heightCm);
      const bmr = this.calculateBMR(profile.age, profile.gender, profile.weightKg, profile.heightCm);
      profile.dailyCalories = this.calculateTDEE(bmr, profile.activityLevel, profile.fitnessGoal);
      
      user.bmr = bmr;
      user.tdee = profile.dailyCalories;
    }

    await user.save();
    await profile.save();

    return { user, profile };
  }
}
