# Manual Firebase Setup & Migration Guide for LibTrack

Because AI Studio's automated Firebase provisioning was declined, the running LibTrack application uses an **Express + SQLite (`data/libtrack.sqlite`)** persistent backend so every feature works immediately out of the box without fabricated credentials.

If you would like to connect LibTrack to your own Firebase project (Authentication, Firestore, and Firebase Hosting), follow these exact steps:

---

## 1. Create a Firebase Project & Register Web App
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add project** (e.g., `libtrack-library-system`).
2. In **Project Overview**, click the **Web (`</>`)** icon to register a new web app (`LibTrack Web`).
3. Copy the generated `firebaseConfig` object (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

## 2. Enable Firebase Authentication
1. In the Firebase Console sidebar, open **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password**.
3. Create your initial Admin user or implement a one-time setup Cloud Function / Firestore `admins/{uid}` document.

## 3. Enable Cloud Firestore
1. Open **Build → Firestore Database → Create database**.
2. Choose **Production mode** and select your preferred region.
3. Create the following 8 collections:
   - `users`, `books`, `students`, `borrowRecords`, `testCases`, `defects`, `settings`, `activityLogs`.

## 4. Recommended Firestore Security Rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    function isAdmin() {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow create: if isSignedIn() && request.auth.uid == userId
                    && request.resource.data.role == 'student';
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    match /books/{bookId} {
      allow read: if isSignedIn();
      allow create, update: if isAdmin()
        && request.resource.data.totalCopies >= 1
        && request.resource.data.availableCopies >= 0
        && request.resource.data.availableCopies <= request.resource.data.totalCopies;
      allow delete: if isAdmin();
    }

    match /students/{studentId} {
      allow read: if isAdmin() || (isSignedIn() && resource.data.email == request.auth.token.email);
      allow write: if isAdmin();
    }

    match /borrowRecords/{recordId} {
      allow read: if isAdmin() || (isSignedIn() && resource.data.studentEmail == request.auth.token.email);
      allow write: if isAdmin();
    }

    match /testCases/{id} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /defects/{id} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /settings/{id} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /activityLogs/{id} {
      allow read, write: if isAdmin();
    }
  }
}
```

## 5. Install Firebase SDK & Deploy to Firebase Hosting (Optional)
```bash
npm install firebase
npm install -g firebase-tools
firebase login
firebase init hosting   # set public directory to "dist", single-page app rewrite = Yes
npm run build
firebase deploy --only hosting,firestore:rules
```
