import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RazorpayCheckout from 'react-native-razorpay';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

export default function PaywallScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<'monthly' | 'yearly'>('monthly');
  const { refreshUser } = useAuth();

  const handleClose = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/v1/payment/start-trial');
      if (response.data.success) {
        await refreshUser();
      }
    } catch (error: any) {
      // silently ignore — trial already used or failed, just navigate away
    } finally {
      setLoading(false);
      router.replace('/(tabs)/(dashboard)');
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const orderResponse = await api.post('/api/v1/payment/create-order', { planType: selected });
      const { orderId, amount, currency, keyId } = orderResponse.data.data;

      const options = {
        description: `${selected === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
        image: 'https://i.imgur.com/3g7nmJC.png',
        currency,
        key: keyId,
        amount,
        name: 'FitApp Pro',
        order_id: orderId,
        prefill: { email: '', contact: '', name: '' },
        theme: { color: '#1A1A1A' },
      };

      RazorpayCheckout.open(options)
        .then(async (data: any) => {
          try {
            const verifyResponse = await api.post('/api/v1/payment/verify', {
              razorpay_order_id: data.razorpay_order_id,
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_signature: data.razorpay_signature,
              planType: selected,
            });
            if (verifyResponse.data.success) {
              Alert.alert('Success', 'You are now a PRO member.');
              await refreshUser();
              router.replace('/(tabs)/(dashboard)');
            }
          } catch {
            Alert.alert('Verification Failed', 'Please contact support.');
          }
        })
        .catch((error: any) => {
          Alert.alert('Error', `Payment failed: ${error.description}`);
        });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Ionicons name="close" size={22} color="#888" />
      </TouchableOpacity>

      {/* Hero */}
      <View style={styles.heroSection}>
        <View style={styles.iconWrap}>
          <Text style={styles.heroEmoji}>🏋️</Text>
        </View>
        <Text style={styles.title}>
          Reach your Goals{'\n'}<Text style={styles.accent}>3.5×</Text> Faster
        </Text>
        <Text style={styles.subtitle}>Unlock everything. Cancel anytime.</Text>
      </View>

      {/* Features */}
      <View style={styles.featuresRow}>
        {['AI Food Scanner', 'Analytics', 'Workouts', 'Priority Support'].map((f, i) => (
          <View key={i} style={styles.featureChip}>
            <Ionicons name="checkmark" size={12} color="#1A1A1A" />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {/* Plan Cards */}
      <View style={styles.cardsRow}>
        {/* Monthly */}
        <TouchableOpacity
          style={[styles.card, selected === 'monthly' && styles.cardSelected]}
          onPress={() => setSelected('monthly')}
          activeOpacity={0.85}
        >
          <View style={styles.badgeRow}>
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>7-day free</Text>
            </View>
          </View>
          <Text style={styles.planPrice}>₹99</Text>
          <Text style={styles.planPeriod}>per month</Text>
          <View style={styles.discountPill}>
            <Text style={styles.discountText}>50% OFF</Text>
          </View>
        </TouchableOpacity>

        {/* Yearly */}
        <TouchableOpacity
          style={[styles.card, selected === 'yearly' && styles.cardSelected]}
          onPress={() => setSelected('yearly')}
          activeOpacity={0.85}
        >
          <View style={styles.badgeRow}>
            <View style={[styles.trialBadge, styles.bestValueBadge]}>
              <Text style={styles.trialBadgeText}>Best Value</Text>
            </View>
          </View>
          <Text style={styles.planPrice}>₹999</Text>
          <Text style={styles.planPeriod}>per year</Text>
          <View style={[styles.discountPill, styles.greenPill]}>
            <Text style={styles.discountText}>SAVE 15%</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={handleSubscribe}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText}>
            {selected === 'monthly' ? 'Start 7-day Free Trial' : 'Subscribe Yearly'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footerNote}>No charge for 7 days · Cancel anytime</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 28,
  },

  /* Close */
  closeButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Hero */
  heroSection: {
    alignItems: 'center',
    flex: 0,
    paddingTop: 4,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroEmoji: {
    fontSize: 42,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  accent: {
    color: '#FF6B00',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    fontWeight: '400',
  },

  /* Features */
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    rowGap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  featureText: {
    fontSize: 12,
    color: '#222',
    fontWeight: '500',
  },

  /* Cards */
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    alignItems: 'flex-start',
  },
  cardSelected: {
    borderColor: '#111',
    backgroundColor: '#F5F5F5',
  },
  badgeRow: {
    marginBottom: 10,
    minHeight: 24,
  },
  trialBadge: {
    backgroundColor: '#FFE4CC',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bestValueBadge: {
    backgroundColor: '#D4F5D4',
  },
  trialBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
  },
  planPrice: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
  },
  planPeriod: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    marginBottom: 12,
  },
  discountPill: {
    backgroundColor: '#FFE4CC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  greenPill: {
    backgroundColor: '#D4F5D4',
  },
  discountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#444',
    letterSpacing: 0.5,
  },

  /* CTA */
  ctaButton: {
    backgroundColor: '#111',
    borderRadius: 30,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerNote: {
    fontSize: 12,
    color: '#AAA',
    textAlign: 'center',
  },
});