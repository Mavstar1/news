self.addEventListener('fetch', function (event) {
  console.log('Fetch event for:', event.request.url);

  const url = new URL(event.request.url);
  const key = url.searchParams.get('key');
  const developerKey = event.request.headers.get('Developer-Key');

  if (url.pathname.includes('/worker') && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          const requestData = await event.request.json();
          if (requestData.action === 'SETDEV') {
            return setDeveloper(requestData.key, requestData.data)
              .then(() =>
                new Response(
                  JSON.stringify({ status: 'success', message: 'Developer data stored successfully.' }),
                  { status: 200 }
                )
              );
          }

          const developerStoreName = await validateDeveloperKey(developerKey);

          switch (requestData.action) {
            case 'CREATEUSER':
              return createUser(requestData.key, requestData.data, developerStoreName)
                .then(() =>
                  new Response(
                    JSON.stringify({ status: 'success', message: 'User created successfully.' }),
                    { status: 200 }
                  )
                );
            case 'SIGNIN':
              return signIn(requestData.key, requestData.data, developerStoreName)
                .then(() =>
                  new Response(
                    JSON.stringify({ status: 'success', message: 'User signed in.' }),
                    { status: 200 }
                  )
                );
            case 'SIGNOUT':
              return signOut(key, developerStoreName)
                .then(() =>
                  new Response(
                    JSON.stringify({ status: 'success', message: 'User signed out.' }),
                    { status: 200 }
                  )
                );
            case 'GETAUTH':
              return getAuth(key, developerStoreName);
            case 'GET':
              return getDataFromDB(key, developerStoreName);
            case 'SET':
              return storeDataInDB(requestData.key, requestData.data, developerStoreName);
            case 'PUT':
              return updateDataInDB(requestData.key, requestData.data, developerStoreName);
            case 'DELETE':
              if (!requestData.key) {
                return new Response(JSON.stringify({ error: 'Key is required for deletion.' }), { status: 400 });
              }
              return removeDataFromDB(requestData.key, developerStoreName);
            default:
              return new Response(JSON.stringify({ error: 'Unsupported method' }), { status: 405 });
          }
        } catch (error) {
          return new Response(
            JSON.stringify({ status: 'error', message: error.message }),
            { status: error.status || 500 }
          );
        }
      })()
    );
  }
});

// Function to validate developer key
function validateDeveloperKey(developerKey) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      if (!developerKey) {
        return reject(new Error('No Developer Key provided.'));
      }

      const transaction = db.transaction('chatStore', 'readonly');
      const store = transaction.objectStore('chatStore');
      const request = store.get('developers/' + developerKey);

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (result && result.data) {
          resolve(result.data.storeName);
        } else {
          reject(new Error('Invalid Developer Key.'));
        }
      };

      request.onerror = (event) =>
        reject(new Error('Error checking Developer Key: ' + event.target.errorCode));
    });
  });
}

// Function to open the IndexedDB database
function openDB(developerStoreName = 'chatStore') {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatDatabase', 1);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('chatStore')) {
        db.createObjectStore('chatStore', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(developerStoreName)) {
        db.createObjectStore(developerStoreName, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(new Error('Error opening the database: ' + event.target.errorCode));
  });
}

// Function to create a user
function createUser(authKey, { email, password }, storeName) {
  const userData = { email, password, authenticated: true };
  return storeDataInDB(authKey, userData, storeName);
}

// Function to sign in a user
function signIn(authKey, { email, password }, storeName) {
  return openDB(storeName).then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.get(authKey);

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (result && result.email === email && result.password === password) {
          result.authenticated = true;

          const updateRequest = store.put(result);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(new Error('Error updating authentication status.'));
        } else {
          reject(new Error('Invalid email or password.'));
        }
      };

      request.onerror = (event) => reject(new Error('Error signing in: ' + event.target.errorCode));
    });
  });
}

// Function to sign out a user
function signOut(authKey, storeName) {
  return openDB(storeName).then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.get(authKey);

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (result) {
          result.authenticated = false;
          store.put(result);
          resolve();
        } else {
          reject(new Error('User not found.'));
        }
      };

      request.onerror = (event) => reject(new Error('Error signing out: ' + event.target.errorCode));
    });
  });
}

// Function to store developer data
function setDeveloper(key, data) {
  const developerStoreName = `dev_${data.developerKey}`;

  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chatStore', 'readwrite');
      const store = transaction.objectStore('chatStore');

      const developerData = { id: key, data: { ...data, storeName: developerStoreName } };
      const request = store.put(developerData);

      request.onsuccess = () => {
        openDB(developerStoreName)
          .then(() => resolve())
          .catch((err) => reject(new Error('Error creating developer object store: ' + err.message)));
      };

      request.onerror = (event) => reject(new Error('Error setting developer: ' + event.target.errorCode));
    });
  });
}

// Function to remove data from the database
function removeDataFromDB(key, storeName) {
  return openDB(storeName).then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(new Response(JSON.stringify({ status: 'success', message: 'Data removed' }), { status: 200 }));
      request.onerror = (event) => reject(new Error('Error removing data: ' + event.target.errorCode));
    });
  });
}