---
description: Build and Deploy to Firebase
---

# Deploy to Firebase Hosting

1.  **Build the Project**:
    ```bash
    npm run build
    ```

2.  **Deploy**:
    This uses `npx` to run firebase tools without global installation.
    ```bash
    npx firebase-tools deploy --only hosting,firestore:rules
    ```

    > **Note**: If it asks you to login, run `npx firebase-tools login` first.
