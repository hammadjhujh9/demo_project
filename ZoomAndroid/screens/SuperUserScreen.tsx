import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, ActivityIndicator, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { theme } from '../utils/theme';
import { CustomInput } from '../components/CustomInput';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../config/firebaseConfig';
import {
  collection, doc, getDocs, updateDoc, query,
  where, addDoc, deleteDoc, orderBy, writeBatch
} from 'firebase/firestore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';

// Define interfaces for our data types
interface User {
  id: string;
  name: string;
  email: string;
  company?: string;
  bank?: string;
  designation?: string;
  contact?: string;
  pending?: boolean;
  approved?: boolean;
  userType?: string;
  [key: string]: any; // For any additional properties
}

interface Company {
  id: string;
  name: string;
  address?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  [key: string]: any;
}

interface Bank {
  id: string;
  name: string;
  swiftCode: string;
  address?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  [key: string]: any;
}

interface UpdateData {
  company?: string | null;
  bank?: string | null;
  designation?: string;
  pending?: boolean;
  approved?: boolean;
  [key: string]: any;
}

type RootStackParamList = {
  SuperUser: undefined;
  AuthLoading: undefined;
  Profile: undefined;
};

type SuperUserScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SuperUser'>;

interface SuperUserScreenProps {
  navigation: SuperUserScreenNavigationProp;
}

export default function SuperUserScreen({ navigation }: SuperUserScreenProps) {
  const { userData, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // users, companies

  // Modals
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form data
  const [companyForm, setCompanyForm] = useState({ name: '', address: '', contactPerson: '', contactEmail: '', contactPhone: '' });
  const [userForm, setUserForm] = useState({ company: '', role: '', userType: 'company' });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchUsers(),
      fetchCompanies()
    ]);
    setRefreshing(false);
  };

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const usersList: User[] = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        usersList.push({
          id: doc.id,
          ...userData,
          // Add a display field for user type
          userType: userData.company ? 'Company' : (userData.designation === 'finance' || userData.designation === 'voucher_create') ? 'Finance' : 'ZoomPay'
        } as User);
      });
      
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      Alert.alert("Error", "Could not load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch all companies
  const fetchCompanies = async () => {
    try {
      const companiesRef = collection(db, 'companies');
      const querySnapshot = await getDocs(companiesRef);
      
      const companiesList: Company[] = [];
      querySnapshot.forEach((doc) => {
        companiesList.push({
          id: doc.id,
          ...doc.data()
        } as Company);
      });
      
      setCompanies(companiesList);
    } catch (error) {
      console.error("Error fetching companies:", error);
      Alert.alert("Error", "Could not load companies. Please try again.");
    }
  };

  // Add new company
  const addCompany = async () => {
    try {
      if (!companyForm.name || !companyForm.contactPerson || !companyForm.contactEmail) {
        Alert.alert("Error", "Please fill in all required fields");
        return;
      }
      
      setLoading(true);
      await addDoc(collection(db, 'companies'), {
        ...companyForm,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || 'unknown'
      });
      
      Alert.alert("Success", "Company added successfully");
      setShowAddCompanyModal(false);
      setCompanyForm({ name: '', address: '', contactPerson: '', contactEmail: '', contactPhone: '' });
      await fetchCompanies();
    } catch (error) {
      console.error("Error adding company:", error);
      Alert.alert("Error", "Could not add company. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Update user assignments
  const updateUser = async () => {
    try {
      if (!selectedUser) return;
      
      const updates: UpdateData = {};
      
      // Handle user type assignment
      if (userForm.userType === 'company' && userForm.company) {
        updates.company = userForm.company;
        updates.bank = null;
      } else if (userForm.userType === 'finance' || userForm.userType === 'zoompay') {
        updates.company = null;
        updates.bank = null;
      }
      
      // Handle role assignment
      if (userForm.role) {
        updates.designation = userForm.role;
        
        // If user is getting a role, they are no longer pending and are approved
        updates.pending = false;
        updates.approved = true;
      }
      
      setLoading(true);
      await updateDoc(doc(db, 'users', selectedUser.id), {
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.uid || 'unknown'
      });
      
      Alert.alert("Success", "User updated successfully");
      setShowEditUserModal(false);
      setUserForm({ company: '', role: '', userType: 'company' });
      setSelectedUser(null);
      await fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      Alert.alert("Error", "Could not update user. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Delete company
  const deleteCompany = async (companyId: string, companyName: string) => {
    Alert.alert(
      "Delete Company",
      `Are you sure you want to delete ${companyName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDoc(doc(db, 'companies', companyId));
              
              // Remove company from all users
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where("company", "==", companyId));
              const querySnapshot = await getDocs(q);
              
              const batch = writeBatch(db);
              querySnapshot.forEach((docSnapshot) => {
                batch.update(docSnapshot.ref, { company: null });
              });
              
              await batch.commit();
              
              Alert.alert("Success", "Company deleted successfully");
              await Promise.all([fetchCompanies(), fetchUsers()]);
            } catch (error) {
              console.error("Error deleting company:", error);
              Alert.alert("Error", "Could not delete company. Please try again.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'AuthLoading' }],
      });
    } catch (err) {
      console.error("Logout error:", err);
      Alert.alert("Error", "Failed to log out. Please try again.");
    }
  };

  // Render user item for list
  const renderUserItem = ({ item }: { item: User }) => {
    const isPending = item.pending || !item.designation;
    const userStatus = isPending ? 'Pending' : 
                      (item.designation ? 'Active' : 'Inactive');

    let statusColor;
    switch (userStatus) {
      case 'Active': statusColor = theme.colors.success; break;
      case 'Pending': statusColor = theme.colors.primary; break;
      default: statusColor = theme.colors.error;
    }

    // Determine badge color based on user type
    const getBadgeColor = () => {
      if (item.company) return '#e3f2fd';
      if (item.designation === 'finance' || item.designation === 'voucher_create') return '#fff8e1';
      return '#f5f5f5'; // ZoomPay
    };

    const getTextColor = () => {
      if (item.company) return '#2196f3';
      if (item.designation === 'finance' || item.designation === 'voucher_create') return '#ffa000';
      return '#424242'; // ZoomPay
    };

    return (
      <TouchableOpacity
        style={[styles.listItem, isPending && styles.pendingItem]}
        onPress={() => {
          setSelectedUser(item);
          let userType = 'zoompay';
          if (item.company) {
            userType = 'company';
          } else if (item.designation === 'finance' || item.designation === 'voucher_create') {
            userType = 'finance';
          }
          
          setUserForm({
            company: item.company || '',
            role: item.designation || '',
            userType
          });
          setShowEditUserModal(true);
        }}
      >
        <View style={styles.listItemContent}>
          <View style={[styles.avatarContainer, isPending && { backgroundColor: theme.colors.primary + '30' }]}>
            <Text style={styles.avatarText}>{item.name ? item.name.substring(0, 1).toUpperCase() : 'U'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
            <View style={styles.userMetadata}>
              <View style={[styles.userTypeBadge, { backgroundColor: getBadgeColor() }]}>
                <Text style={[styles.userTypeText, { color: getTextColor() }]}>
                  {item.company ? 'Company' : 
                   (item.designation === 'finance' || item.designation === 'voucher_create') ? 'Finance' : 'ZoomPay'}
                </Text>
              </View>
              <View style={[styles.userRoleBadge, { backgroundColor: item.designation ? '#e8f5e9' : '#fafafa' }]}>
                <Text style={[styles.userRoleText, { color: item.designation ? '#4caf50' : '#9e9e9e' }]}>
                  {item.designation || 'No Role'}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{userStatus}</Text>
              </View>
            </View>
          </View>
        </View>
        {isPending && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Needs Approval</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render company item for list
  const renderCompanyItem = ({ item }: { item: Company }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemContent}>
        <View style={[styles.avatarContainer, { backgroundColor: '#e3f2fd' }]}>
          <Text style={[styles.avatarText, { color: '#2196f3' }]}>{item.name.substring(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{item.name}</Text>
          <Text style={styles.companyDetail}>{item.contactPerson}</Text>
          <Text style={styles.companyDetail}>{item.contactEmail}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteCompany(item.id, item.name)}
      >
        <MaterialCommunityIcons name="delete" size={24} color={theme.colors.error} />
      </TouchableOpacity>
    </View>
  );

  // Create tabs for navigation
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'users' && styles.activeTab]}
        onPress={() => setActiveTab('users')}
      >
        <MaterialCommunityIcons 
          name="account-group" 
          size={24} 
          color={activeTab === 'users' ? theme.colors.primary : theme.colors.textLight} 
        />
        <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Users</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'companies' && styles.activeTab]}
        onPress={() => setActiveTab('companies')}
      >
        <MaterialCommunityIcons 
          name="domain" 
          size={24} 
          color={activeTab === 'companies' ? theme.colors.primary : theme.colors.textLight} 
        />
        <Text style={[styles.tabText, activeTab === 'companies' && styles.activeTabText]}>Companies</Text>
      </TouchableOpacity>
    </View>
  );

  // Render Add Company Modal
  const renderAddCompanyModal = () => (
    <Modal
      visible={showAddCompanyModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAddCompanyModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New Company</Text>
            <TouchableOpacity onPress={() => setShowAddCompanyModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <CustomInput
              label="Company Name *"
              value={companyForm.name}
              onChangeText={(text) => setCompanyForm({...companyForm, name: text})}
              placeholder="Enter company name"
            />
            <CustomInput
              label="Address"
              value={companyForm.address}
              onChangeText={(text) => setCompanyForm({...companyForm, address: text})}
              placeholder="Enter company address"
            />
            <CustomInput
              label="Contact Person *"
              value={companyForm.contactPerson}
              onChangeText={(text) => setCompanyForm({...companyForm, contactPerson: text})}
              placeholder="Enter contact person name"
            />
            <CustomInput
              label="Contact Email *"
              value={companyForm.contactEmail}
              onChangeText={(text) => setCompanyForm({...companyForm, contactEmail: text})}
              placeholder="Enter contact email"
              keyboardType="email-address"
            />
            <CustomInput
              label="Contact Phone"
              value={companyForm.contactPhone}
              onChangeText={(text) => setCompanyForm({...companyForm, contactPhone: text})}
              placeholder="Enter contact phone"
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={styles.submitButton}
              onPress={addCompany}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Add Company</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Render Edit User Modal
  const renderEditUserModal = () => {
    if (!selectedUser) return null;

    const companyOptions = companies.map(company => ({
      label: company.name,
      value: company.id,
    }));

    // Define role options based on user type
    let roleOptions = [];
    
    if (userForm.userType === 'company') {
      roleOptions = [
        { label: 'Admin', value: 'admin' },
        { label: 'Payee', value: 'payee' },
      ];
    } else if (userForm.userType === 'finance') {
      roleOptions = [
        { label: 'Finance Manager', value: 'finance' },
        { label: 'Voucher Creator', value: 'voucher_create' },
      ];
    } else { // ZoomPay
      roleOptions = [
        { label: 'Checker', value: 'checker' },
        { label: 'Initiator', value: 'initiator' },
        { label: 'Payment Releaser', value: 'payment_releaser' },
      ];
    }

    return (
      <Modal
        visible={showEditUserModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User</Text>
              <TouchableOpacity onPress={() => setShowEditUserModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalSubtitle}>User Information</Text>
              <View style={styles.userInfoCard}>
                <Text style={styles.userInfoName}>{selectedUser.name}</Text>
                <Text style={styles.userInfoEmail}>{selectedUser.email}</Text>
                <Text style={styles.userInfoDetail}>Contact: {selectedUser.contact || 'Not provided'}</Text>
                <View style={styles.userTypeContainer}>
                  <View style={[styles.userTypeBadge, { 
                    backgroundColor: 
                      selectedUser.company ? '#e3f2fd' : 
                      (selectedUser.designation === 'finance' || selectedUser.designation === 'voucher_create') ? '#fff8e1' : 
                      '#f5f5f5'
                  }]}>
                    <Text style={[styles.userTypeText, { 
                      color: 
                        selectedUser.company ? '#2196f3' : 
                        (selectedUser.designation === 'finance' || selectedUser.designation === 'voucher_create') ? '#ffa000' : 
                        '#424242'
                    }]}>
                      {selectedUser.company ? 'Company' : 
                       (selectedUser.designation === 'finance' || selectedUser.designation === 'voucher_create') ? 'Finance' : 
                       'ZoomPay'}
                    </Text>
                  </View>
                  <View style={[styles.userRoleBadge, { backgroundColor: selectedUser.designation ? '#e8f5e9' : '#fafafa' }]}>
                    <Text style={[styles.userRoleText, { color: selectedUser.designation ? '#4caf50' : '#9e9e9e' }]}>
                      {selectedUser.designation || 'No Role'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Assign User Type</Text>
              <View style={styles.radioGroup}>
                <Text style={styles.radioLabel}>User Type:</Text>
                <View style={styles.radioOptions}>
                  <TouchableOpacity
                    style={[styles.radioOption, userForm.userType === 'company' ? styles.radioOptionSelected : null]}
                    onPress={() => {
                      setUserForm({...userForm, userType: 'company', role: ''});
                    }}
                  >
                    <Text style={[styles.radioText, userForm.userType === 'company' ? styles.radioTextSelected : null]}>Company</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.radioOption, userForm.userType === 'finance' ? styles.radioOptionSelected : null]}
                    onPress={() => {
                      setUserForm({...userForm, userType: 'finance', company: '', role: ''});
                    }}
                  >
                    <Text style={[styles.radioText, userForm.userType === 'finance' ? styles.radioTextSelected : null]}>Finance</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.radioOption, userForm.userType === 'zoompay' ? styles.radioOptionSelected : null]}
                    onPress={() => {
                      setUserForm({...userForm, userType: 'zoompay', company: '', role: ''});
                    }}
                  >
                    <Text style={[styles.radioText, userForm.userType === 'zoompay' ? styles.radioTextSelected : null]}>ZoomPay</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {userForm.userType === 'company' && (
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerLabel}>Select Company:</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.pickerScrollView}
                  >
                    {companyOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.pickerItem,
                          userForm.company === option.value && styles.pickerItemSelected
                        ]}
                        onPress={() => setUserForm({...userForm, company: option.value})}
                      >
                        <Text 
                          style={[
                            styles.pickerItemText,
                            userForm.company === option.value && styles.pickerItemTextSelected
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.sectionTitle}>Assign Role</Text>
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Select Role:</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.pickerScrollView}
                >
                  {roleOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.pickerItem,
                        userForm.role === option.value && styles.pickerItemSelected
                      ]}
                      onPress={() => setUserForm({...userForm, role: option.value})}
                    >
                      <Text 
                        style={[
                          styles.pickerItemText,
                          userForm.role === option.value && styles.pickerItemTextSelected
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={updateUser}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Update User</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Main render function
  return (
    <SafeAreaView style={styles.container}>
      {/* Replace the header with AppHeader */}
      <AppHeader 
        title="ZoomPay Admin"
        subtitle="Super User Dashboard"
        navigation={navigation}
        onRefresh={loadAllData}
      />

      {/* Tabs */}
      {renderTabs()}

      {/* Content */}
      <View style={styles.content}>
        {/* Users Tab */}
        {activeTab === 'users' && (
          <>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>User Management</Text>
              <Text style={styles.listSubtitle}>{users.length} Users</Text>
            </View>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading users...</Text>
              </View>
            ) : (
              <FlatList
                data={users}
                renderItem={renderUserItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContainer}
                refreshing={refreshing}
                onRefresh={loadAllData}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="account-off" size={64} color={theme.colors.textLight} />
                    <Text style={styles.emptyText}>No users found</Text>
                    <Text style={styles.emptySubtext}>
                      Users will appear here after they sign up
                    </Text>
                  </View>
                }
              />
            )}
          </>
        )}

        {/* Companies Tab */}
        {activeTab === 'companies' && (
          <>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Company Management</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddCompanyModal(true)}
              >
                <MaterialCommunityIcons name="plus" size={20} color="white" />
                <Text style={styles.addButtonText}>Add Company</Text>
              </TouchableOpacity>
            </View>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading companies...</Text>
              </View>
            ) : (
              <FlatList
                data={companies}
                renderItem={renderCompanyItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContainer}
                refreshing={refreshing}
                onRefresh={loadAllData}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="domain-off" size={64} color={theme.colors.textLight} />
                    <Text style={styles.emptyText}>No companies found</Text>
                    <Text style={styles.emptySubtext}>
                      Add your first company using the button above
                    </Text>
                  </View>
                }
              />
            )}
          </>
        )}
      </View>

      {/* Modals */}
      {renderAddCompanyModal()}
      {renderEditUserModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    padding: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.textLight,
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: 'white',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.text,
  },
  listSubtitle: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 20,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '500',
    marginLeft: 4,
  },
  listContainer: {
    padding: theme.spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pendingItem: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  listItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: 4,
  },
  userMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  userTypeBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  userTypeText: {
    fontSize: 12,
  },
  userRoleBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  userRoleText: {
    fontSize: 12,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
  },
  pendingBadge: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    alignSelf: 'flex-start',
  },
  pendingText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  companyDetail: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  bankDetail: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  deleteButton: {
    padding: theme.spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    marginTop: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.textLight,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalContent: {
    padding: theme.spacing.md,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textLight,
    marginBottom: theme.spacing.sm,
  },
  userInfoCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  userInfoName: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 4,
  },
  userInfoEmail: {
    fontSize: 16,
    color: theme.colors.textLight,
    marginBottom: 4,
  },
  userInfoDetail: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: 8,
  },
  userTypeContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  radioGroup: {
    marginBottom: theme.spacing.md,
  },
  radioLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  radioOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  radioOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  radioOptionSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  radioText: {
    color: theme.colors.text,
  },
  radioTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  pickerContainer: {
    marginBottom: theme.spacing.md,
  },
  pickerLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  pickerScrollView: {
    maxHeight: 50,
  },
  pickerItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pickerItemText: {
    color: theme.colors.text,
  },
  pickerItemTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
});