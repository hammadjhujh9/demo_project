// firebaseConfig.ts
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
// Remove getAnalytics for Android if causing issues
// import { getAnalytics } from "firebase/analytics";

// You don't need to manually configure Firebase for Android
// It will use the google-services.json file automatically

// Export the modules
export const db = firestore();
export const authInstance = auth();
export const storageInstance = storage();

// // For backward compatibility
// export const auth = authInstance;
// export const storage = storageInstance;

// Export the app instance
export default firebase;