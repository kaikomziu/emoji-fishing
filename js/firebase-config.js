// ===== Firebase 設定 =====
// プロジェクト: emoji-fishing (https://console.firebase.google.com/project/emoji-fishing)
// この値は公開されても問題ない情報です（実際のアクセス制御は Firestore セキュリティルールで行います）。

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC3J-VJwr6TF86xXqLism3SvoDs_cHbmKE",
  authDomain: "emoji-fishing.firebaseapp.com",
  projectId: "emoji-fishing",
  storageBucket: "emoji-fishing.firebasestorage.app",
  messagingSenderId: "80770423929",
  appId: "1:80770423929:web:8b654266cf1d620dd788a8",
};

// 管理者アカウントのメールアドレス（Firebase Authentication > Users で作成したもの）
// Firestoreセキュリティルール側（firestore.rules）でもこのメールアドレスと一致させています。
const ADMIN_EMAIL = "sekineyuki12345@gmail.com";
