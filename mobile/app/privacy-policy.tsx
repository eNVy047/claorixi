import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  const sections = [
    {
      title: '📋 Information We Collect',
      content: 'We collect profile data (name, age, height, weight), food logs, physical activity, device sensor data (steps), and camera usage for food image analysis.',
    },
    {
      title: '🎯 How We Use Your Data',
      content: 'Your data is used to personalize your fitness goals, calculate nutritional needs, track progress, and improve the app\'s overall experience and accuracy.',
    },
    {
      title: '🤖 AI & Gemini API',
      content: 'Food images are sent to Google\'s Gemini API for nutritional analysis. Images are processed securely and are not stored permanently on our servers.',
    },
    {
      title: '💳 Payments',
      content: 'Payments are handled securely by Razorpay. Caloxi does not store or have access to your credit card details or other sensitive payment information.',
    },
    {
      title: '🔔 Push Notifications',
      content: 'We use Firebase to send important updates and reminders. You can enable or disable these notifications at any time in your device settings.',
    },
    {
      title: '🔒 Data Security',
      content: 'We use industry-standard security measures, including JWT authentication, encrypted database storage, and bcrypt for password hashing.',
    },
    {
      title: '👤 Your Rights',
      content: 'You have the right to edit your profile or delete your account and all associated data at any time through the Profile settings.',
    },
    {
      title: '📧 Contact Us',
      content: 'If you have any questions or concerns regarding our privacy practices, please contact our support team at support@caloxi.com.',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      {/* Dark Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <Text style={styles.headerSubtitle}>Last updated: March 2026</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionText}>{section.content}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.understandButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.understandButtonText}>I Understand</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 25,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    padding: 10,
    marginRight: 10,
    marginLeft: -10,
  },
  backArrow: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  sectionText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    fontWeight: '400',
  },
  footer: {
    padding: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  understandButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  understandButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
