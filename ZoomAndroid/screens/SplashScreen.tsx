import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../utils/theme';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { CustomButton } from '../components/CustomButton';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

type RootStackParamList = {
  Login: undefined;
  Splash: undefined;
  AuthLoading: undefined;
};

type SplashScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

interface SplashScreenProps {
  navigation: SplashScreenNavigationProp;
}

export default function SplashScreen({ navigation }: SplashScreenProps) {
  const { currentUser } = useAuth();

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        // Wait a bit to show the splash screen
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if user is logged in
        if (currentUser) {
          // User is logged in, go to AuthLoading to determine role
          navigation.replace('AuthLoading');
        } else {
          // No user, go to login
          navigation.replace('Login');
        }
      } catch (error) {
        console.error('Error checking auth state:', error);
        navigation.replace('Login');
      }
    };
    
    checkAuthState();
  }, [currentUser, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons name="wallet-outline" size={80} color={theme.colors.primary} />
          <Text style={styles.title}>ZoomPay</Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <CustomButton
            title="Get Started"
            onPress={() => navigation.replace('Login')}
            style={styles.button}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Developed by Kvorx</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginTop: theme.spacing.md,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: theme.spacing.xl,
  },
  button: {
    width: '100%',
  },
  footer: {
    marginBottom: theme.spacing.xl,
  },
  footerText: {
    fontSize: 16,
    color: theme.colors.textLight,
    textAlign: 'center',
  },
});