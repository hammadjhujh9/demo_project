import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { theme } from '../utils/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Define the navigation type with common screens
interface NavigationProps {
  navigate: (screen: string) => void;
  reset: (config: { index: number; routes: { name: string }[] }) => void;
}

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  navigation: NavigationProps;
  showRefreshButton?: boolean;
  onRefresh?: () => void;
  showProfileButton?: boolean;
  customRightComponent?: React.ReactNode;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  navigation,
  showRefreshButton = true,
  onRefresh,
  showProfileButton = true,
  customRightComponent
}) => {
  const { userData, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'AuthLoading' }],
      });
    } catch (err) {
      console.error("Logout error:", err);
      // You can handle the error here, e.g., show an alert
    }
  };

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle || userData?.name ? (
          <Text style={styles.subtitle}>{subtitle || userData?.name || 'User'}</Text>
        ) : null}
      </View>
      
      <View style={styles.headerButtons}>
        {customRightComponent}
        
        {showProfileButton && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Icon name="account" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
        
        {showRefreshButton && onRefresh && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onRefresh}
          >
            <Icon name="refresh" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleLogout}
        >
          <Icon name="logout" size={24} color={theme.colors.textLight} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerButtons: { 
    flexDirection: 'row', 
    alignItems: 'center'
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: theme.colors.text 
  },
  subtitle: { 
    fontSize: 14, 
    color: theme.colors.textLight 
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginLeft: theme.spacing.xs,
  }
});

export default AppHeader;