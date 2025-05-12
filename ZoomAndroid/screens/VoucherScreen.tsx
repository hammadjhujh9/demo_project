import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  TextInput,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ImagePicker from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { db, storage, auth } from '../config/firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  orderBy,
  addDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { theme } from '../utils/theme';
import { format } from 'date-fns';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';

// Define types
interface Receipt {
  id: string;
  imageUrl: string;
  status: string;
  createdAt: string | Timestamp;
  createdBy: string;
  userName?: string;
  userEmail?: string;
  company?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  comments?: Comment[];
  rejectedReason?: string;
}

interface Voucher {
  id: string;
  receiptId: string;
  voucherUrl: string;
  imageUrl: string;
  status: string;
  createdAt: string | Timestamp;
  createdBy: string;
  createdByName: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  description: string;
  amount: number;
  ticketNumber: string;
  company: string;
  comments?: Comment[];
}

interface Comment {
  text: string;
  createdAt: string | Timestamp;
  createdBy: string;
  createdByName: string;
  role: string;
}

type RootStackParamList = {
  VoucherScreen: undefined;
  Profile: undefined;
  AuthLoading: undefined;
};

type VoucherScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VoucherScreen'>;

interface VoucherScreenProps {
  navigation: VoucherScreenNavigationProp;
}

export default function VoucherScreen({ navigation }: VoucherScreenProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comment, setComment] = useState('');
  const [voucherForm, setVoucherForm] = useState({
    description: '',
    voucherFile: null as any
  });
  const [voucherFormErrors, setVoucherFormErrors] = useState({} as any);
  const [voucherCreating, setVoucherCreating] = useState(false);

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'receipts', title: 'Approved Receipts' },
    { key: 'vouchers', title: 'Created Vouchers' },
  ]);

  const { userData, logout } = useAuth();
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchApprovedReceipts(), fetchCreatedVouchers()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchApprovedReceipts = async () => {
    try {
      const vouchersRef = collection(db, 'vouchers');
      const q = query(
        vouchersRef,
        where('status', '==', 'approved'),
        orderBy('approvedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const approvedList: Receipt[] = [];
      
      snapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        approvedList.push({
          id: docSnapshot.id,
          imageUrl: data.receiptUrl || data.imageUrl,
          ...data as Omit<Receipt, 'id'>
        });
      });
      
      setReceipts(approvedList);
    } catch (error) {
      console.error('Error fetching approved vouchers:', error);
      throw error;
    }
  };

  const fetchCreatedVouchers = async () => {
    try {
      const vouchersRef = collection(db, 'vouchers');
      const q = query(
        vouchersRef,
        where('createdBy', '==', auth.currentUser?.uid || ''),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const voucherList: Voucher[] = [];
      
      snapshot.forEach(docSnapshot => {
        voucherList.push({
          id: docSnapshot.id,
          ...docSnapshot.data() as Omit<Voucher, 'id'>
        });
      });
      
      setVouchers(voucherList);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      throw error;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const validateVoucherForm = () => {
    const errors = {} as any;
    
    if (!voucherForm.description.trim()) {
      errors.description = 'Description is required';
    }
    
    if (!voucherForm.voucherFile) {
      errors.voucherFile = 'Voucher document is required';
    }
    
    setVoucherFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateVoucher = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setVoucherForm({
      description: '',
      voucherFile: null
    });
    setVoucherFormErrors({});
    setShowVoucherModal(true);
  };

  const pickVoucherDocument = async () => {
    try {
      ImagePicker.launchImageLibrary({
        mediaType: 'mixed',
        includeBase64: false,
        maxHeight: 200,
        maxWidth: 200,
      }, (response) => {
        if (response.didCancel) {
          console.log('User cancelled file picker');
        } else if (response.errorCode) {
          console.log('ImagePicker Error: ', response.errorMessage);
        } else {
          // Use response.uri for the file path
          const uri = response.assets?.[0]?.uri;
          // Continue with file handling
          setVoucherForm({ ...voucherForm, voucherFile: { uri } });
          setVoucherFormErrors({ ...voucherFormErrors, voucherFile: undefined });
        }
      });
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const submitVoucher = async () => {
    if (!selectedReceipt) return;
    
    // Check if required fields are filled
    if (!voucherForm.description.trim() || !voucherForm.voucherFile) {
      const errors = {} as any;
      
      if (!voucherForm.description.trim()) {
        errors.description = 'Description is required';
      }
      
      if (!voucherForm.voucherFile) {
        errors.voucherFile = 'Voucher document is required';
      }
      
      setVoucherFormErrors(errors);
      return;
    }
    
    try {
      setVoucherCreating(true);
      
      // Upload the voucher file
      let voucherUrl = '';
      if (voucherForm.voucherFile) {
        const { uri, mimeType, name } = voucherForm.voucherFile;
        
        // Generate a unique filename for storage with proper extension
        const timestamp = Date.now();
        const fileExtension = name.split('.').pop() || 'pdf';
        const storageFileName = `vouchers/${timestamp}-${auth.currentUser?.uid || 'unknown'}.${fileExtension}`;
        
        try {
          // Convert file to blob using fetch
          const response = await fetch(uri);
          const blob = await response.blob();
          
          // Create a storage reference
          const storageRef = ref(storage, storageFileName);
          
          // Upload the blob
          const uploadTask = await uploadBytes(storageRef, blob);
          
          // Get download URL
          voucherUrl = await getDownloadURL(storageRef);
        } catch (uploadError: any) {
          console.error('Error in file upload:', uploadError);
          throw new Error(`File upload failed: ${uploadError.message}`);
        }
      } else {
        throw new Error('No voucher file selected');
      }
      
      // Generate ticket number
      const ticketNumber = `VOC${Date.now().toString().slice(-6)}`;
      
      // Update existing voucher with voucher details
      await updateDoc(doc(db, 'vouchers', selectedReceipt.id), {
        voucherUrl,
        status: 'voucher_created',
        processedBy: auth.currentUser?.uid || '',
        processedByName: userData?.name || 'Unknown',
        processedAt: new Date().toISOString(),
        description: voucherForm.description,
        ticketNumber
      });
      
      Alert.alert('Success', 'Voucher created successfully!');
      
      setShowVoucherModal(false);
      await fetchData();
    } catch (error: any) {
      console.error('Error creating voucher:', error);
      Alert.alert('Error', `Failed to create voucher: ${error.message || 'Unknown error'}`);
    } finally {
      setVoucherCreating(false);
    }
  };

  const viewImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  };

  // This function doesn't return a value (it's void)
  const downloadFile = async (url: string, filename: string) => {
    try {
      const fileUri = `${RNFS.DocumentDirectoryPath}/${filename}`;
      const options = {
        fromUrl: url,
        toFile: fileUri,
      };
      
      const result = await RNFS.downloadFile(options).promise;
      
      if (result.statusCode === 200) {
        Alert.alert(
          'Download Complete',
          `File saved to: ${fileUri}`,
          [
            { text: 'Close' },
            { 
              text: 'Share', 
              onPress: () => shareFile(fileUri)
            }
          ]
        );
      } else {
        Alert.alert('Download Failed', 'Could not download the file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const shareFile = async (fileUri: string) => {
    try {
      const options = {
        url: `file://${fileUri}`,
      };
      
      await Share.open(options);
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert('Error', 'Failed to share file');
    }
  };

  const addComment = async () => {
    if (!selectedVoucher) return;
    if (!comment.trim()) {
      Alert.alert('Empty Comment', 'Please enter a comment');
      return;
    }

    try {
      setIsLoading(true);
      
      const newComment = {
        text: comment,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || '',
        createdByName: userData?.name || 'Unknown User',
        role: 'voucher'
      };
      
      await updateDoc(doc(db, 'vouchers', selectedVoucher.id), {
        comments: [...(selectedVoucher.comments || []), newComment]
      });
      
      setComment('');
      setShowCommentModal(false);
      fetchData();
      Alert.alert('Success', 'Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewComments = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setShowCommentModal(true);
  };

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

  const renderReceiptItem = ({ item }: { item: Receipt }) => {
    const formattedDate = typeof item.approvedAt === 'string'
      ? format(new Date(item.approvedAt), 'dd MMM yyyy, hh:mm a')
      : item.approvedAt 
        ? format((item.approvedAt as any).toDate(), 'dd MMM yyyy, hh:mm a')
        : 'Unknown';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderContent}>
            <Text style={styles.cardTitle}>
              {item.company || 'Unknown Company'}
            </Text>
            <Text style={styles.cardSubtitle}>
              Voucher #{item.id.substring(0, 6)}
            </Text>
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Submitted by:</Text>
            <Text style={styles.infoValue}>{item.userName || 'Unknown'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Approved by:</Text>
            <Text style={styles.infoValue}>{item.approvedBy || 'Unknown'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Approved on:</Text>
            <Text style={styles.infoValue}>{formattedDate}</Text>
          </View>
        </View>
        
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => viewImage(item.imageUrl || item.receiptUrl)}
          >
            <MaterialCommunityIcons name="image-outline" size={20} color="white" />
            <Text style={styles.actionButtonText}>View Image</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
            onPress={() => handleCreateVoucher(item)}
          >
            <MaterialCommunityIcons name="file-document-outline" size={20} color="white" />
            <Text style={styles.actionButtonText}>Create Voucher</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderVoucherItem = ({ item }: { item: Voucher }) => {
    const formattedDate = typeof item.createdAt === 'string'
      ? format(new Date(item.createdAt), 'dd MMM yyyy, hh:mm a')
      : format((item.createdAt as any).toDate(), 'dd MMM yyyy, hh:mm a');

    const statusColors = {
      in_progress: theme.colors.warning,
      checked: theme.colors.success,
      initiated: theme.colors.primary,
      payment_released: theme.colors.success,
      payment_closed: theme.colors.success,
      rejected: theme.colors.error,
      voucher_created: theme.colors.warning,
    };

    const statusText = {
      in_progress: 'Pending Review',
      checked: 'Checked',
      initiated: 'Initiated',
      payment_released: 'Payment Released',
      payment_closed: 'Payment Closed',
      rejected: 'Rejected',
      voucher_created: 'Voucher Created',
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderContent}>
            <Text style={styles.cardTitle}>
              {item.ticketNumber || `Voucher #${item.id.substring(0, 6)}`}
            </Text>
            <Text style={styles.cardSubtitle}>
              {item.company || 'Unknown Company'}
            </Text>
          </View>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: `${statusColors[item.status as keyof typeof statusColors] || theme.colors.textLight}20` }
          ]}>
            <Text style={[
              styles.statusText, 
              { color: statusColors[item.status as keyof typeof statusColors] || theme.colors.textLight }
            ]}>
              {statusText[item.status as keyof typeof statusText] || item.status}
            </Text>
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Amount:</Text>
            <Text style={styles.infoValueHighlight}>
              ${item.amount ? item.amount.toLocaleString() : '0'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Bank:</Text>
            <Text style={styles.infoValue}>{item.bankName || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account:</Text>
            <Text style={styles.infoValue}>
              {item.accountTitle || 'N/A'} {item.accountNumber ? `(${item.accountNumber})` : ''}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created:</Text>
            <Text style={styles.infoValue}>{formattedDate}</Text>
          </View>
          
          {item.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionLabel}>Description:</Text>
              <Text style={styles.descriptionText}>{item.description}</Text>
            </View>
          )}

          {item.comments && item.comments.length > 0 && (
            <TouchableOpacity 
              style={styles.commentsButton}
              onPress={() => handleViewComments(item)}
            >
              <MaterialCommunityIcons name="comment-multiple-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.commentsButtonText}>
                {item.comments.length} {item.comments.length === 1 ? 'Comment' : 'Comments'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => viewImage(item.imageUrl || item.receiptUrl)}
          >
            <MaterialCommunityIcons name="image-outline" size={20} color="white" />
            <Text style={styles.actionButtonText}>View Receipt</Text>
          </TouchableOpacity>
          
          {item.voucherUrl && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.colors.secondary }]}
              onPress={() => viewImage(item.voucherUrl)}
            >
              <MaterialCommunityIcons name="file-document-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>View Voucher</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderScene = SceneMap({
    receipts: () => (
      <FlatList
        data={receipts}
        renderItem={renderReceiptItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="file-document-outline" size={64} color={theme.colors.textLight} />
            <Text style={styles.emptyText}>No approved vouchers found</Text>
            <Text style={styles.emptySubText}>
              Vouchers approved by Finance Officers will appear here
            </Text>
          </View>
        }
      />
    ),
    vouchers: () => (
      <FlatList
        data={vouchers}
        renderItem={renderVoucherItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="file-document-outline" size={64} color={theme.colors.textLight} />
            <Text style={styles.emptyText}>No vouchers created yet</Text>
            <Text style={styles.emptySubText}>
              Vouchers you create will appear here
            </Text>
          </View>
        }
      />
    ),
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Replace the header with AppHeader */}
      <AppHeader 
        title="Voucher Creator"
        subtitle={userData?.name || 'ZoomPay Employee'}
        navigation={navigation}
        onRefresh={fetchData}
      />

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      ) : (
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: Dimensions.get('window').width }}
          renderTabBar={props => (
            <TabBar
              {...props}
              style={styles.tabBar}
              indicatorStyle={styles.tabIndicator}
              activeColor={theme.colors.primary}
              inactiveColor={theme.colors.textLight}
            />
          )}
        />
      )}

      {/* Create Voucher Modal */}
      <Modal
        visible={showVoucherModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVoucherModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Voucher</Text>
                <TouchableOpacity onPress={() => setShowVoucherModal(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                {/* Display existing bank details and amount */}
                {selectedReceipt && (
                  <View style={styles.existingDetailsContainer}>
                    <Text style={styles.formSectionTitle}>Payment Details</Text>
                    
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Amount:</Text>
                      <Text style={styles.infoValueHighlight}>
                        ${selectedReceipt.amount ? 
                            (typeof selectedReceipt.amount === 'number' ? 
                              selectedReceipt.amount.toLocaleString() : 
                              selectedReceipt.amount) : 
                            'N/A'}
                      </Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Bank:</Text>
                      <Text style={styles.infoValue}>{selectedReceipt.bankName || 'N/A'}</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Account:</Text>
                      <Text style={styles.infoValue}>
                        {selectedReceipt.accountTitle || 'N/A'} 
                        {selectedReceipt.accountNumber ? `(${selectedReceipt.accountNumber})` : ''}
                      </Text>
                    </View>
                  </View>
                )}
                
                <Text style={styles.formSectionTitle}>Voucher Information</Text>
                
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textArea, voucherFormErrors.description && styles.inputError]}
                  placeholder="Enter description or purpose of payment"
                  value={voucherForm.description}
                  onChangeText={(text) => {
                    setVoucherForm({...voucherForm, description: text});
                    if (voucherFormErrors.description) {
                      setVoucherFormErrors({...voucherFormErrors, description: undefined});
                    }
                  }}
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                {voucherFormErrors.description && <Text style={styles.errorText}>{voucherFormErrors.description}</Text>}
                
                <Text style={styles.formSectionTitle}>Upload Voucher Document</Text>
                
                <TouchableOpacity 
                  style={[styles.uploadButton, voucherFormErrors.voucherFile && styles.uploadButtonError]}
                  onPress={pickVoucherDocument}
                >
                  <MaterialCommunityIcons 
                    name="upload" 
                    size={24} 
                    color={voucherFormErrors.voucherFile ? theme.colors.error : theme.colors.primary} 
                  />
                  <Text style={[
                    styles.uploadButtonText,
                    voucherFormErrors.voucherFile && { color: theme.colors.error }
                  ]}>
                    {voucherForm.voucherFile 
                      ? `Selected: ${voucherForm.voucherFile.name}`
                      : 'Click to Upload Voucher Document'
                    }
                  </Text>
                </TouchableOpacity>
                {voucherFormErrors.voucherFile && <Text style={styles.errorText}>{voucherFormErrors.voucherFile}</Text>}
                
                <TouchableOpacity
                  style={[styles.submitButton, voucherCreating && styles.disabledButton]}
                  onPress={submitVoucher}
                  disabled={voucherCreating}
                >
                  {voucherCreating ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="check" size={20} color="white" />
                      <Text style={styles.submitButtonText}>Create Voucher</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.imageModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Document Preview</Text>
              <TouchableOpacity onPress={() => setShowImageModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.previewContainer} 
              contentContainerStyle={styles.previewContentContainer}
            >
              {selectedImage && selectedImage.toLowerCase().endsWith('.pdf') ? (
                <View style={styles.pdfPreviewContainer}>
                  <MaterialCommunityIcons name="file-pdf-box" size={80} color={theme.colors.error} />
                  <Text style={styles.pdfText}>PDF Document</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: selectedImage || '' }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              )}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  if (selectedImage) {
                    const filename = `zoompay_document_${Date.now()}.${selectedImage.toLowerCase().endsWith('.pdf') ? 'pdf' : 'jpg'}`;
                    downloadFile(selectedImage, filename);
                  }
                }}
              >
                <MaterialCommunityIcons name="download" size={20} color="white" />
                <Text style={styles.modalActionButtonText}>Download</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: theme.colors.secondary }]}
                onPress={() => {
                  if (selectedImage) {
                    const filename = `zoompay_document_${Date.now()}.${selectedImage.toLowerCase().endsWith('.pdf') ? 'pdf' : 'jpg'}`;
                    downloadFile(selectedImage, filename);
                  }
                }}
              >
                <MaterialCommunityIcons name="share-variant" size={20} color="white" />
                <Text style={styles.modalActionButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={showCommentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCommentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setShowCommentModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={selectedVoucher?.comments || []}
              keyExtractor={(item, index) => `comment-${index}`}
              style={styles.commentsList}
              contentContainerStyle={
                selectedVoucher?.comments?.length === 0 ? { flex: 1, justifyContent: 'center', alignItems: 'center' } : {}
              }
              ListEmptyComponent={
                <Text style={styles.emptyComments}>No comments yet</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>
                      {item.createdByName}
                      <Text style={styles.commentRole}> ({item.role})</Text>
                    </Text>
                    <Text style={styles.commentDate}>
                      {typeof item.createdAt === 'string'
                        ? format(new Date(item.createdAt), 'dd MMM yyyy, h:mm a')
                        : format((item.createdAt as Timestamp).toDate(), 'dd MMM yyyy, h:mm a')}
                    </Text>
                  </View>
                  <Text style={styles.commentText}>{item.text}</Text>
                </View>
              )}
            />
            
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={2}
              />
              <TouchableOpacity
                style={[styles.sendButton, !comment.trim() && styles.disabledButton]}
                onPress={addComment}
                disabled={!comment.trim() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <MaterialCommunityIcons name="send" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabBar: {
    backgroundColor: 'white',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabIndicator: {
    backgroundColor: theme.colors.primary,
    height: 3,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textLight,
    fontSize: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  cardHeaderContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardContent: {
    padding: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.textLight,
    flex: 2,
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.text,
    flex: 3,
    textAlign: 'right',
  },
  infoValueHighlight: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 3,
    textAlign: 'right',
  },
  descriptionContainer: {
    marginTop: 8,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: 8,
  },
  descriptionLabel: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 4,
    flex: 1,
    margin: 4,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '500',
    marginLeft: 4,
    fontSize: 14,
  },
  commentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  commentsButtonText: {
    fontSize: 12,
    color: theme.colors.primary,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.textLight,
    marginTop: theme.spacing.md,
  },
  emptySubText: {
    fontSize: 14,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoidingView: {
    width: '100%',
    maxHeight: '90%',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
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
  modalBody: {
    padding: theme.spacing.md,
    maxHeight: 500,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  inputLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    fontSize: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  textArea: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    fontSize: 16,
    minHeight: 100,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginTop: -8,
    marginBottom: theme.spacing.sm,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
  },
  uploadButtonError: {
    borderColor: theme.colors.error,
  },
  uploadButtonText: {
    marginLeft: theme.spacing.sm,
    color: theme.colors.textLight,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: theme.colors.success,
    borderRadius: 8,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    flexDirection: 'row',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  imageModalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewContainer: {
    flex: 1,
    maxHeight: 400,
  },
  previewContentContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: Dimensions.get('window').width * 0.8,
    height: 400,
  },
  pdfPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  pdfText: {
    fontSize: 16,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalActionButtonText: {
    color: 'white',
    fontWeight: '500',
    marginLeft: 8,
    fontSize: 14,
  },
  commentsList: {
    maxHeight: 300,
    padding: theme.spacing.md,
  },
  commentItem: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: 8,
    marginBottom: theme.spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  commentRole: {
    fontStyle: 'italic',
    color: theme.colors.textLight,
  },
  commentDate: {
    fontSize: 12,
    color: theme.colors.textLight,
  },
  commentText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  emptyComments: {
    color: theme.colors.textLight,
    textAlign: 'center',
    fontSize: 14,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  commentInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  existingDetailsContainer: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
});
