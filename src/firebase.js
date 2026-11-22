import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyCzPVi9i2NPsHT_t38VtKu5Ab63imATm20",
  authDomain: "ftc-grader.firebaseapp.com",
  projectId: "ftc-grader",
  storageBucket: "ftc-grader.firebasestorage.app",
  messagingSenderId: "920858315653",
  appId: "1:920858315653:web:3de3b5c8a917b1bae292ec",
  measurementId: "G-YWM8MWLXMV"
};

export const firebaseApp = initializeApp(firebaseConfig);
