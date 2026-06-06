import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import apiClient, { BASE_URL } from './config';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const QUEUE_KEY = '@inspection_offline_queue';

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
  private onProgressCallback: ((count: number) => void) | null = null;
  private networkListenerUnsubscribe: (() => void) | null = null;

  constructor() {
    this.startListening();
  }

  setCallback(cb: (count: number) => void) {
    this.onProgressCallback = cb;
  }

  /**
   * Start listening for network changes to auto-sync
   */
  startListening() {
    if (this.networkListenerUnsubscribe) return;

    this.networkListenerUnsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
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

  private async uploadImage(uri: string, attempt = 1): Promise<string> {
    const MAX_RETRIES = 3;
    try {
      const uploadUrl = `${BASE_URL}files/upload`;
      const token = await SecureStore.getItemAsync('user_token');

      console.log(`[OfflineQueue] Upload attempt ${attempt}/${MAX_RETRIES} for: ${uri}`);
      
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
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, targetUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'X-App-Type': 'mobile-app'
        },
      });

      const responseData = JSON.parse(uploadResult.body);

      if (uploadResult.status === 200 || uploadResult.status === 201) {
        if (responseData.success) {
          return responseData.data.url || responseData.data.filename || responseData.data.id;
        }
      }
      
      throw new Error(responseData.message || `Upload failed with status ${uploadResult.status}`);
    } catch (err: any) {
      if (err.message === 'FILE_NOT_FOUND') throw err;

      if (attempt < MAX_RETRIES) {
        const delay = attempt * 2000;
        console.warn(`[OfflineQueue] Sync attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return this.uploadImage(uri, attempt + 1);
      }
      throw err;
    }
  }

  private async processPayloadImages(payload: any): Promise<any> {
    if (!payload || typeof payload !== 'object') return payload;

    const newPayload = Array.isArray(payload) ? [...payload] : { ...payload };

    for (const key of Object.keys(newPayload)) {
      const val = newPayload[key];
      
      if (typeof val === 'string' && val.startsWith('file://')) {
        try {
          console.log(`[OfflineQueue] Uploading queued image...`);
          const url = await this.uploadImage(val);
          newPayload[key] = url;
        } catch (err) {
          console.error(`[OfflineQueue] Failed to upload queued image`, err);
          throw err; 
        }
      } else if (typeof val === 'object' && val !== null) {
        newPayload[key] = await this.processPayloadImages(val);
      }
    }
    return newPayload;
  }

  /**
   * Process the queue if online
   */
  async processQueue() {
    if (this.isProcessing) return;
    
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      console.log('[OfflineQueue] No internet, skipping queue processing');
      return;
    }

    const queue = await this.getQueue();
    if (queue.length === 0) return;

    console.log(`[OfflineQueue] Starting to process ${queue.length} items...`);
    this.isProcessing = true;

    const remainingQueue: QueuedSubmission[] = [];

    for (const item of queue) {
      try {
        let response;
        if (item.endpoint) {
          console.log(`[OfflineQueue] Syncing request ${item.id}: ${item.method || 'POST'} ${item.endpoint}...`);
          const method = item.method || 'POST';
          if (method === 'POST') {
            response = await apiClient.post(item.endpoint, item.payload);
          } else if (method === 'PUT') {
            response = await apiClient.put(item.endpoint, item.payload);
          } else {
            throw new Error(`Unsupported method: ${method}`);
          }
        } else {
          console.log(`[OfflineQueue] Syncing item ${item.id} for form ${item.formId}...`);
          
          // 1. Process any pending local file:// images in the payload
          const processedPayload = await this.processPayloadImages(item.payload);

          // 2. Use the same endpoint as real submission
          response = await apiClient.post(`/responses/${item.formId}`, processedPayload);
        }
        
        if (response && response.data && response.data.success) {
          console.log(`[OfflineQueue] Successfully synced ${item.id}`);
        } else {
          throw new Error((response && response.data && response.data.message) || 'Server error during sync');
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message;
        const errorStatus = error.response?.status;
        
        console.warn(`[OfflineQueue] Sync failure for ${item.id}:`, errorMsg, `(Status: ${errorStatus}). Keeping in queue for retry.`);
        remainingQueue.push({
          ...item,
          retries: item.retries + 1
        });
      }

      // Update stored queue and trigger callback
      const currentQueue = [...remainingQueue, ...queue.slice(queue.indexOf(item) + 1)];
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(currentQueue));
      if (this.onProgressCallback) this.onProgressCallback(currentQueue.length);
    }

    this.isProcessing = false;
    
    if (remainingQueue.length > 0) {
      console.log(`[OfflineQueue] Finished processing. ${remainingQueue.length} items remain in queue.`);
    } else {
      console.log('[OfflineQueue] All items synced successfully!');
    }
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
      if (this.onProgressCallback) this.onProgressCallback(filtered.length);
      console.log(`[OfflineQueue] Removed ${id} from queue. Remaining: ${filtered.length}`);
    } catch (error) {
      console.error('[OfflineQueue] Error removing from queue:', error);
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
