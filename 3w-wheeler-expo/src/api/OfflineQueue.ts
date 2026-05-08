import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import apiClient from './config';

const QUEUE_KEY = '@inspection_offline_queue';

export interface QueuedSubmission {
  id: string;
  formId: string;
  payload: any;
  timestamp: string;
  retries: number;
}

class OfflineQueueService {
  private isProcessing = false;

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

  private async uploadImage(uri: string): Promise<string> {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || `upload_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      let type = match ? `image/${match[1].toLowerCase()}` : `image/jpeg`;

      // Standardize common types
      if (type === 'image/jpg') type = 'image/jpeg';
      if (!type.includes('/')) type = 'image/jpeg';

      formData.append('file', {
        uri,
        name: filename,
        type
      } as any);

      console.log(`[OfflineQueue] Uploading image: ${filename} (${type})`);

      const resp = await apiClient.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        transformRequest: (data) => data,
      });

      if (resp.data?.success) {
        return resp.data.data.url || resp.data.data.filename || resp.data.data.id;
      }
      throw new Error(resp.data?.message || 'Upload failed');
    } catch (err: any) {
      console.error('[OfflineQueue] Image upload failed:', err.response?.data?.message || err.message, `(Status: ${err.response?.status})`);
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
        console.log(`[OfflineQueue] Syncing item ${item.id} for form ${item.formId}...`);
        
        // 1. Process any pending local file:// images in the payload
        const processedPayload = await this.processPayloadImages(item.payload);

        // 2. Use the same endpoint as real submission
        const response = await apiClient.post(`/responses/${item.formId}`, processedPayload);
        
        if (response.data.success) {
          console.log(`[OfflineQueue] Successfully synced ${item.id}`);
        } else {
          throw new Error(response.data.message || 'Server error during sync');
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message;
        const errorStatus = error.response?.status;
        console.error(`[OfflineQueue] Failed to sync ${item.id}:`, errorMsg, `(Status: ${errorStatus})`);
        
        // Keep in queue if it's a network error or transient server error
        if (item.retries < 10) {
          remainingQueue.push({
            ...item,
            retries: item.retries + 1
          });
        } else {
          console.error(`[OfflineQueue] Max retries reached for ${item.id}. Dropping.`);
        }
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    this.isProcessing = false;
    
    if (remainingQueue.length > 0) {
      console.log(`[OfflineQueue] Finished processing. ${remainingQueue.length} items remain in queue.`);
    } else {
      console.log('[OfflineQueue] All items synced successfully!');
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
