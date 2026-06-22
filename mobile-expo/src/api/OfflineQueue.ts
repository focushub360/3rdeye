import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import apiClient, { BASE_URL, checkServerReachability } from './config';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform, AppState, AppStateStatus } from 'react-native';

const QUEUE_KEY = '@inspection_offline_queue';

export interface QueueProgressInfo {
  itemId?: string;
  percent: number;
  filename: string;
  statusText?: string;
}

export interface QueuedSubmission {
  id: string;
  formId?: string;
  endpoint?: string;
  method?: 'POST' | 'PUT';
  payload: any;
  timestamp: string;
  retries: number;
}

class OfflineQueueService {
  private isProcessing = false;
  private onProgressCallback: ((count: number, progressInfo?: QueueProgressInfo | null, isProcessing?: boolean) => void) | null = null;
  private networkListenerUnsubscribe: (() => void) | null = null;

  constructor() {
    this.startListening();
    this.setupAppStateListener();
    this.startPeriodicSync();
  }

  private async getActiveToken(): Promise<string | null> {
    // 1. Try global axios header (fast, in-memory)
    const authHeader = apiClient.defaults.headers.common['Authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token) return token;
    }
    
    // 2. Fallback to SecureStore
    try {
      return await SecureStore.getItemAsync('user_token');
    } catch (err) {
      console.error('[OfflineQueue] Error reading token from SecureStore:', err);
      return null;
    }
  }

  private startPeriodicSync() {
    // Fast periodic check (every 5 seconds) to upload queued items immediately when online with no lag
    setInterval(() => {
      this.processQueue();
    }, 5000);
  }

  private setupAppStateListener() {
    AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[OfflineQueue] App came to foreground! Checking queue...');
        this.processQueue();
      }
    });
  }

  setCallback(cb: (count: number, progressInfo?: QueueProgressInfo | null, isProcessing?: boolean) => void) {
    this.onProgressCallback = cb;
  }

  /**
   * Start listening for network changes to auto-sync
   */
  startListening() {
    if (this.networkListenerUnsubscribe) return;

    this.networkListenerUnsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        console.log('[OfflineQueue] Network restored! Checking queue...');
        this.processQueue();
      }
    });
  }

  stopListening() {
    if (this.networkListenerUnsubscribe) {
      this.networkListenerUnsubscribe();
      this.networkListenerUnsubscribe = null;
    }
  }

  /**
   * Add a submission to the offline queue
   */
  async addToQueue(formId: string, payload: any) {
    try {
      const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: QueuedSubmission[] = queueJson ? JSON.parse(queueJson) : [];
      
      const newEntry: QueuedSubmission = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        formId,
        payload,
        timestamp: new Date().toISOString(),
        retries: 0
      };

      queue.push(newEntry);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log(`[OfflineQueue] Added submission to queue. Total: ${queue.length}`);
      
      // Auto-trigger sync immediately if online
      this.processQueue();
      
      return newEntry.id;
    } catch (error) {
      console.error('[OfflineQueue] Error adding to queue:', error);
      throw error;
    }
  }

  /**
   * Add a general API request (check-in/check-out) to the offline queue
   */
  async addRequestToQueue(endpoint: string, method: 'POST' | 'PUT', payload: any) {
    try {
      const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: QueuedSubmission[] = queueJson ? JSON.parse(queueJson) : [];
      
      const newEntry: QueuedSubmission = {
        id: `offline_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        endpoint,
        method,
        payload,
        timestamp: new Date().toISOString(),
        retries: 0
      };

      queue.push(newEntry);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log(`[OfflineQueue] Added request to queue: ${method} ${endpoint}. Total: ${queue.length}`);
      
      // Auto-trigger sync immediately if online
      this.processQueue();
      
      return newEntry.id;
    } catch (error) {
      console.error('[OfflineQueue] Error adding request to queue:', error);
      throw error;
    }
  }

  /**
   * Get all queued items
   */
  async getQueue(): Promise<QueuedSubmission[]> {
    try {
      const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
      return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
      console.error('[OfflineQueue] Error getting queue:', error);
      return [];
    }
  }

  private async uploadImage(uri: string, itemId: string, attempt = 1): Promise<string> {
    const MAX_RETRIES = 3;
    try {
      const uploadUrl = `${apiClient.defaults.baseURL}files/upload`;
      const token = await this.getActiveToken();

      console.log(`[OfflineQueue] Upload attempt ${attempt}/${MAX_RETRIES} for: ${uri} (item: ${itemId})`);
      
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        console.error(`[OfflineQueue] File not found: ${uri}`);
        throw new Error('FILE_NOT_FOUND');
      }

      // Compress image before upload
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      const targetUri = manipulatedImage.uri;
      const filename = uri.split('/').pop() || 'image.jpg';

      // Create upload task with progress callback
      const uploadTask = FileSystem.createUploadTask(
        uploadUrl,
        targetUri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: 'image/jpeg',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'X-App-Type': 'mobile-app'
          },
        },
        (progress) => {
          if (progress.totalBytesExpectedToSend > 0) {
            const percent = Math.round((progress.totalBytesSent / progress.totalBytesExpectedToSend) * 100);
            if (this.onProgressCallback) {
              // Pass -1 for queue count during internal updates to not trigger checkQueue redraws prematurely, but update percent
              this.onProgressCallback(-1, { itemId, percent, filename, statusText: `Uploading image: ${filename}` }, this.isProcessing);
            }
          }
        }
      );

      const uploadResult = await uploadTask.uploadAsync();
      if (!uploadResult) {
        throw new Error('Upload failed: No result returned from upload task');
      }

      const responseData = JSON.parse(uploadResult.body);

      if (uploadResult.status === 401) {
        console.warn('[OfflineQueue] 401 Unauthorized from upload task. Session expired.');
        await SecureStore.deleteItemAsync('user_token');
        throw new Error('UNAUTHORIZED_EXPIRED_SESSION');
      }

      if (uploadResult.status === 200 || uploadResult.status === 201) {
        if (responseData.success) {
          // Clean up local persistent offline image if successful
          if (uri.startsWith(FileSystem.documentDirectory + '3w_offline_images/')) {
            try {
              await FileSystem.deleteAsync(uri, { idempotent: true });
              console.log(`[OfflineQueue] Cleaned up persistent offline image: ${uri}`);
            } catch (delErr) {
              console.warn('[OfflineQueue] Failed to delete persistent offline file:', delErr);
            }
          }
          return responseData.data.url || responseData.data.filename || responseData.data.id;
        }
      }
      
      throw new Error(responseData.message || `Upload failed with status ${uploadResult.status}`);
    } catch (err: any) {
      if (err.message === 'FILE_NOT_FOUND' || err.message === 'UNAUTHORIZED_EXPIRED_SESSION') throw err;

      if (attempt < MAX_RETRIES) {
        const delay = attempt * 2000;
        console.warn(`[OfflineQueue] Sync attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return this.uploadImage(uri, itemId, attempt + 1);
      }
      throw err;
    }
  }

  private async processPayloadImages(payload: any, itemId: string): Promise<any> {
    if (!payload || typeof payload !== 'object') return payload;

    const newPayload = Array.isArray(payload) ? [...payload] : { ...payload };
    const uploadTasks: { key: string | number, parent: any, uri: string }[] = [];

    // Helper to find all local file:// URIs recursively in the payload
    const findImages = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === 'string' && val.startsWith('file://')) {
          uploadTasks.push({ key, parent: obj, uri: val });
        } else if (typeof val === 'object' && val !== null) {
          findImages(val);
        }
      }
    };

    findImages(newPayload);

    if (uploadTasks.length === 0) return newPayload;

    console.log(`[OfflineQueue] Found ${uploadTasks.length} queued images. Uploading in PARALLEL for high speed...`);
    
    // Upload all images concurrently
    const uploadPromises = uploadTasks.map(async (task) => {
      try {
        const url = await this.uploadImage(task.uri, itemId);
        task.parent[task.key] = url;
      } catch (err: any) {
        console.error(`[OfflineQueue] Failed to upload queued image: ${task.uri} for item: ${itemId}`, err);
        if (err.message === 'FILE_NOT_FOUND') {
          console.warn(`[OfflineQueue] Image file not found locally (likely cleared by OS cache). Setting to empty.`);
          task.parent[task.key] = '';
          return;
        }
        throw err;
      }
    });

    await Promise.all(uploadPromises);
    return newPayload;
  }

  async processQueue(): Promise<{ success: boolean, failedCount: number, errors: string[] }> {
    if (this.isProcessing) return { success: false, failedCount: 0, errors: ['Already processing sync queue'] };
    
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      console.log('[OfflineQueue] No internet, skipping queue processing');
      return { success: false, failedCount: 0, errors: ['No internet connection available'] };
    }

    // Determine correct endpoint dynamically before syncing
    await checkServerReachability();

    const queue = await this.getQueue();
    if (queue.length === 0) return { success: true, failedCount: 0, errors: [] };

    const token = await this.getActiveToken();
    if (!token) {
      console.log('[OfflineQueue] No active session (token is missing), skipping queue processing.');
      return { success: false, failedCount: queue.length, errors: ['No active user session. Please log in first.'] };
    }

    console.log(`[OfflineQueue] Starting to process ${queue.length} items...`);
    this.isProcessing = true;
    if (this.onProgressCallback) {
      this.onProgressCallback(queue.length, null, this.isProcessing);
    }

    const remainingQueue: QueuedSubmission[] = [];
    const errors: string[] = [];

    for (const item of queue) {
      // 1. Fresh check: Verify if the user deleted this item while sync was in progress
      const freshQueue = await this.getQueue();
      const stillExists = freshQueue.some(qItem => qItem.id === item.id);
      if (!stillExists) {
        console.log(`[OfflineQueue] Item ${item.id} was deleted by user. Skipping.`);
        continue;
      }

      const itemTitle = item.formId ? 'Inspection Report' :
                        item.endpoint === 'hr/attendance/checkin' ? 'Shift Check-In' :
                        item.endpoint === 'hr/attendance/checkout' ? 'Shift Check-Out' :
                        item.endpoint === 'hr/leaves/apply' ? 'Leave Request' :
                        item.endpoint === 'hr/permissions/apply' ? 'Permission Request' : 'API Request';
      if (this.onProgressCallback) {
        this.onProgressCallback(freshQueue.length, { itemId: item.id, percent: 0, filename: '', statusText: `Syncing ${itemTitle}...` }, this.isProcessing);
      }
      try {
        let response;
        if (item.endpoint) {
          console.log(`[OfflineQueue] Syncing request ${item.id}: ${item.method || 'POST'} ${item.endpoint}...`);
          const method = item.method || 'POST';
          if (method === 'POST') {
            response = await apiClient.post(item.endpoint, item.payload, { _isOfflineQueueRequest: true } as any);
          } else if (method === 'PUT') {
            response = await apiClient.put(item.endpoint, item.payload, { _isOfflineQueueRequest: true } as any);
          } else {
            throw new Error(`Unsupported method: ${method}`);
          }
        } else {
          console.log(`[OfflineQueue] Syncing item ${item.id} for form ${item.formId}...`);
          
          // 2. Process any pending local file:// images in the payload (in parallel)
          const processedPayload = await this.processPayloadImages(item.payload, item.id);

          // 3. Use the same endpoint as real submission
          response = await apiClient.post(`/responses/${item.formId}`, processedPayload, { _isOfflineQueueRequest: true } as any);
        }
        
        if (response && response.data && response.data.success) {
          console.log(`[OfflineQueue] Successfully synced ${item.id}`);
          // Success: Remove item cleanly from AsyncStorage
          await this.removeFromQueue(item.id);
        } else {
          throw new Error((response && response.data && response.data.message) || 'Server error during sync');
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message;
        const errorStatus = error.response?.status;
        
        console.warn(`[OfflineQueue] Sync failure for ${item.id}:`, errorMsg, `(Status: ${errorStatus}). Keeping in queue for retry.`);
        errors.push(`${itemTitle}: ${errorMsg}`);
        
        // Failure: Increment retry count cleanly in AsyncStorage
        await this.updateItemRetry(item.id);
        remainingQueue.push({
          ...item,
          retries: item.retries + 1
        });

        // Abort the entire sync loop if unauthorized/expired session
        if (errorStatus === 401 || error.message === 'UNAUTHORIZED_EXPIRED_SESSION') {
          console.warn('[OfflineQueue] Session expired (401). Aborting sync loop.');
          break;
        }
      }
    }

    this.isProcessing = false;
    const finalCount = (await this.getQueue()).length;
    
    if (finalCount > 0) {
      console.log(`[OfflineQueue] Finished processing. ${finalCount} items remain in queue.`);
    } else {
      console.log('[OfflineQueue] All items synced successfully!');
    }
    
    // Final clear of progress info
    if (this.onProgressCallback) {
      this.onProgressCallback(finalCount, null, this.isProcessing);
    }

    return {
      success: remainingQueue.length === 0,
      failedCount: remainingQueue.length,
      errors
    };
  }

  /**
   * Remove a specific item from the queue by ID
   */
  async removeFromQueue(id: string) {
    try {
      const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
      if (!queueJson) return;
      const queue: QueuedSubmission[] = JSON.parse(queueJson);
      const filtered = queue.filter(item => item.id !== id);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
      if (this.onProgressCallback) this.onProgressCallback(filtered.length, null, this.isProcessing);
      console.log(`[OfflineQueue] Removed ${id} from queue. Remaining: ${filtered.length}`);
    } catch (error) {
      console.error('[OfflineQueue] Error removing from queue:', error);
    }
  }

  async updateItemRetry(id: string) {
    try {
      const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
      if (!queueJson) return;
      const queue: QueuedSubmission[] = JSON.parse(queueJson);
      const updated = queue.map(item => {
        if (item.id === id) {
          return { ...item, retries: item.retries + 1 };
        }
        return item;
      });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('[OfflineQueue] Error updating retry count:', error);
    }
  }

  /**
   * Clear the entire queue
   */
  async clearQueue() {
    await AsyncStorage.removeItem(QUEUE_KEY);
  }
}

export const offlineQueue = new OfflineQueueService();
