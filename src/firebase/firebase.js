import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCm4j4cdjWsCYRwH9p5_wtmjgfmK4TzqsA",
  authDomain: "spendwise-e9863.firebaseapp.com",
  projectId: "spendwise-e9863",
  storageBucket: "spendwise-e9863.firebasestorage.app",
  messagingSenderId: "569722527466",
  appId: "1:569722527466:web:9c0fc901011635da168193",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
